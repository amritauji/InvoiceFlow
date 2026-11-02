import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/logo.webp';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="bg-background dark:bg-[#0f1423] text-on-background dark:text-[#e1e3f0] h-screen flex overflow-hidden font-body-md text-body-md antialiased selection:bg-primary-container selection:text-on-primary-container transition-colors">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-outline-variant dark:border-[#2e3650] relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3525cd 50%, #0051d5 100%)' }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }}></div>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-on-primary/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <img src={logo} alt="InvoiceFlow Logo" className="w-12 h-12 rounded-xl shadow-lg border border-white/30" />
            <span className="font-headline-md text-headline-md text-white tracking-tight font-semibold">InvoiceFlow</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display-lg text-display-lg text-white mb-6 leading-tight">Streamline your financial approvals.</h1>
            <p className="font-body-md text-body-md text-white/80 mb-12">Automate invoice processing, ensure compliance, and maintain a crystal-clear audit trail with our enterprise-grade workflow management system.</p>
            <div className="space-y-5">
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-white font-semibold">Automated Routing</h3>
                  <p className="font-body-sm text-body-sm text-white/70 mt-1">Intelligent workflows direct approvals to the right controllers instantly.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-white font-semibold">Immutable Audit Trail</h3>
                  <p className="font-body-sm text-body-sm text-white/70 mt-1">Every action is logged and time-stamped for complete historical transparency.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>speed</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-white font-semibold">Lightning Fast</h3>
                  <p className="font-body-sm text-body-sm text-white/70 mt-1">Process invoices in seconds with our optimized approval engine.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-white/60 font-body-sm text-body-sm mt-8">&copy; 2024 InvoiceFlow Enterprise Solutions</div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-gray-50 dark:bg-[#0f1423] relative transition-colors">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/80 dark:bg-[#1e2538] border border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-[#e1e3f0] hover:bg-gray-100 dark:hover:bg-[#242c42] transition-colors shadow-sm z-20"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="material-symbols-outlined text-[20px]">{dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/50 dark:bg-indigo-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="w-full max-w-[440px] relative z-10">
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <img src={logo} alt="InvoiceFlow Logo" className="w-14 h-14 rounded-2xl shadow-lg" />
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">InvoiceFlow</span>
          </div>
          <div className="bg-white dark:bg-[#1e2538] p-8 sm:p-10 rounded-2xl shadow-[0_20px_50px_-12px_rgba(53,37,205,0.25)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-[#2e3650] relative overflow-hidden transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-500"></div>
            <div className="mb-8 text-center sm:text-left">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
                <span className="material-symbols-outlined text-white text-2xl">login</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-[#e1e3f0] mb-2">Welcome back</h2>
              <p className="text-gray-500 dark:text-[#8d95b0]">Sign in to your account to continue</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-[#8d95b0] mb-2 uppercase tracking-wide" htmlFor="email">Corporate Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-gray-400 dark:text-[#8d95b0] group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors">mail</span>
                  </div>
                  <input autoComplete="email" className="appearance-none block w-full pl-11 pr-3 py-3.5 border border-gray-300 dark:border-[#2e3650] rounded-xl bg-white dark:bg-[#242c42] text-gray-900 dark:text-[#e1e3f0] placeholder-gray-400 dark:placeholder:text-[#8d95b0] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all hover:border-indigo-400 dark:hover:border-[#8d95b0]" id="email" name="email" placeholder="name@company.com" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-[#8d95b0] mb-2 uppercase tracking-wide" htmlFor="password">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-gray-400 dark:text-[#8d95b0] group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors">lock</span>
                  </div>
                  <input autoComplete="current-password" className="appearance-none block w-full pl-11 pr-11 py-3.5 border border-gray-300 dark:border-[#2e3650] rounded-xl bg-white dark:bg-[#242c42] text-gray-900 dark:text-[#e1e3f0] placeholder-gray-400 dark:placeholder:text-[#8d95b0] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all hover:border-indigo-400 dark:hover:border-[#8d95b0]" id="password" name="password" placeholder="••••••••" required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button aria-label="Toggle password visibility" className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 dark:text-[#8d95b0] hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none transition-colors" type="button" onClick={() => setShowPassword(!showPassword)}>
                    <span className="material-symbols-outlined">{showPassword ? "visibility" : "visibility_off"}</span>
                  </button>
                </div>
              </div>
              <div className="pt-3">
                <button className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/30 font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed" type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-gray-400 dark:text-[#8d95b0] text-sm">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            </div>
            <span>Enterprise Grade Security &amp; Encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
