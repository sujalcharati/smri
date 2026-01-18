import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setToken } = useAuthStore()

  useEffect(() => {
    const handleAuth = async () => {
      const token = searchParams.get('token')
      const error = searchParams.get('error')

      if (error) {
        navigate('/auth?error=' + error)
        return
      }

      if (token) {
        await setToken(token)
        navigate('/app')
      } else {
        navigate('/auth')
      }
    }

    handleAuth()
  }, [navigate, searchParams, setToken])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mx-auto mb-4 animate-pulse">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-muted-foreground">Please wait while we sign you in</p>
      </div>
    </div>
  )
}
