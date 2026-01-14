import { Router, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { authenticate, generateToken, AuthRequest } from '../middleware/auth.js';
import { createOAuth2Client, getAuthUrl } from '../services/googleDrive.js';
import { google } from 'googleapis';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register with email/password
router.post('/register', async (req, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Create user
    const user = new User({ email, password, name });
    await user.save();

    // Create default workspace
    const workspace = new Workspace({
      name: `${name}'s Workspace`,
      ownerId: user._id,
      members: [{ userId: user._id, role: 'owner' }],
    });
    await workspace.save();

    // Add workspace to user
    user.workspaces.push(workspace._id);
    await user.save();

    // Generate token
    const token = generateToken(user._id.toString());

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      workspace: {
        id: workspace._id,
        name: workspace.name,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login with email/password
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Get user's workspaces
    const workspaces = await Workspace.find({ 'members.userId': user._id }).select('_id name');

    // Generate token
    const token = generateToken(user._id.toString());

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        hasGoogleAuth: !!user.googleId,
      },
      workspaces,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google OAuth - Get auth URL
router.get('/google', (req, res: Response) => {
  const oauth2Client = createOAuth2Client();
  const authUrl = getAuthUrl(oauth2Client);
  res.json({ authUrl });
});

// Google OAuth - Callback
router.get('/google/callback', async (req, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    res.redirect(`${process.env.CLIENT_URL}/auth?error=missing_code`);
    return;
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      res.redirect(`${process.env.CLIENT_URL}/auth?error=no_email`);
      return;
    }

    // Find or create user
    let user = await User.findOne({
      $or: [{ googleId: googleUser.id }, { email: googleUser.email }],
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      user = new User({
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatar: googleUser.picture,
        googleId: googleUser.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
      });
      await user.save();
      isNewUser = true;

      // Create default workspace
      const workspace = new Workspace({
        name: `${user.name}'s Workspace`,
        ownerId: user._id,
        members: [{ userId: user._id, role: 'owner' }],
        settings: { driveIntegration: true },
      });
      await workspace.save();

      user.workspaces.push(workspace._id);
      await user.save();
    } else {
      // Update tokens
      user.googleId = googleUser.id;
      user.googleAccessToken = tokens.access_token;
      if (tokens.refresh_token) {
        user.googleRefreshToken = tokens.refresh_token;
      }
      if (!user.avatar && googleUser.picture) {
        user.avatar = googleUser.picture;
      }
      await user.save();
    }

    // Generate JWT
    const token = generateToken(user._id.toString());

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}&new=${isNewUser}`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect(`${process.env.CLIENT_URL}/auth?error=oauth_failed`);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const workspaces = await Workspace.find({ 'members.userId': user._id }).select('_id name');

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        hasGoogleAuth: !!user.googleId,
        hasDriveAccess: !!user.googleAccessToken,
      },
      workspaces,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Logout (client-side token removal, but we can invalidate refresh tokens here)
router.post('/logout', authenticate, async (_req: AuthRequest, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
