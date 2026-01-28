import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Brain,
  Search,
  Workflow,
  Network,
  Sparkles,
  ArrowRight,
  FileText,
  MessageSquare,
  Zap,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'

const features = [
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Natural language search across all your documents. Find answers instantly.',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat',
    description: 'Chat with your knowledge base. Get contextual answers with source citations.',
  },
  {
    icon: Network,
    title: 'Knowledge Graph',
    description: 'Visualize connections between documents, people, and concepts.',
  },
  {
    icon: Workflow,
    title: 'Workflow Automation',
    description: 'Create AI-powered workflows to automate repetitive knowledge tasks.',
  },
]

const stats = [
  { value: '80%', label: 'Time Saved' },
  { value: '10x', label: 'Faster Onboarding' },
  { value: '100%', label: 'Secure' },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-white/80 backdrop-blur-xl dark:bg-slate-900/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">SMRI</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button asChild>
                <Link to="/app">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/50 dark:bg-slate-800/50 px-4 py-2 mb-6">
            <Brain className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">Powered by Google Gemini AI</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your AI-Powered
            <span className="gradient-text block">Knowledge Teammate</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Stop wasting hours searching through docs, wikis, and Slack. SMRI understands
            your organization's knowledge and works like a real teammate.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="gradient" asChild className="text-lg px-8">
              <Link to="/auth">
                Start Free <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Watch Demo
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 mt-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need to unlock knowledge
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            SMRI combines powerful AI with your existing tools to create a unified knowledge experience.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group rounded-2xl border bg-white/50 dark:bg-slate-800/50 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Integration Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 p-12 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Connect Your Knowledge Sources
          </h2>
          <p className="text-white/80 mb-8 max-w-2xl mx-auto">
            Seamlessly integrate with Google Drive, Docs, Sheets, and more.
            Your data stays secure and private.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
              <FileText className="h-5 w-5" />
              <span>Google Drive</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
              <FileText className="h-5 w-5" />
              <span>Google Docs</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
              <Zap className="h-5 w-5" />
              <span>PDF Files</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
              <Shield className="h-5 w-5" />
              <span>Secure & Private</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to transform your workplace?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join forward-thinking teams using AI to unlock their knowledge potential.
          </p>
          <Button size="lg" variant="gradient" asChild className="text-lg px-8">
            <Link to="/auth">
              Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-slate-900/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              <span className="font-bold">SMRI</span>
              <span className="text-muted-foreground">- AI Workplace Assistant</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built with Google Gemini AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
