import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Mascot } from "../components/Blobs";
import { useHandDrawn } from "../hooks/useHandDrawn";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const handDrawnStyle = useHandDrawn();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4 relative">
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <Mascot className="mx-auto mb-4" />
          <h1 className="text-4xl font-extrabold text-warm-900 mb-2">Langy</h1>
          <p className="text-warm-500">
            Learn languages with spaced repetition
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white hand-drawn p-6 shadow-lg"
          style={handDrawnStyle}
        >
          <h2 className="text-xl font-bold text-warm-900 mb-6">
            {isRegister ? "Create account" : "Welcome back"}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-warm-100 rounded-xl border border-warm-200 px-4 py-3 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-warm-100 rounded-xl border border-warm-200 px-4 py-3 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>
            /com
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-coral hover:bg-coral-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition shadow-sm"
          >
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>

          <p className="text-center text-sm text-warm-500 mt-4">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="text-coral hover:text-coral-hover font-bold"
            >
              {isRegister ? "Sign in" : "Register"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
