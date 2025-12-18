import { useState, useContext, useEffect } from "react";
import { register } from "../../../api/auth";
import { GoogleLogin } from "@react-oauth/google";
import { AuthContext } from "../../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { FaUser, FaEnvelope, FaLock, FaUserPlus, FaHome } from "react-icons/fa";

function Register() {
  const { setUser, setToken } = useContext(AuthContext);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // SEO Meta Tags
  useEffect(() => {
    document.title = "Đăng ký - Cửa hàng quà tặng";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Đăng ký tài khoản mới để mua sắm quà tặng và nhận nhiều ưu đãi đặc biệt. Đăng ký nhanh với Google.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Đăng ký tài khoản mới để mua sắm quà tặng và nhận nhiều ưu đãi đặc biệt. Đăng ký nhanh với Google.';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await register(form);
      setMessage(res.data.message || "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.");
      setForm({ name: "", email: "", password: "" });
      
      // Chuyển đến trang đăng nhập sau 2 giây
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      const msg = err.response?.data?.message || "Lỗi máy chủ, vui lòng thử lại.";
      setMessage("⚠️ " + msg);
    } finally {
      setLoading(false);
    }
  };

  // Đăng ký / đăng nhập bằng Google
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setMessage("");
      
      const res = await axios.post("https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/auth/google/callback", {
        token: credentialResponse.credential,
      });

      const tokenValue = res.data.access_token || res.data.token;
      const userData = res.data.user;

      if (tokenValue && userData) {
        // Validate token
        if (typeof tokenValue !== 'string' || tokenValue === 'undefined' || tokenValue === 'null' || tokenValue.trim().length === 0) {
          setMessage("⚠️ Token không hợp lệ từ Google login");
          setLoading(false);
          return;
        }

        try {
          localStorage.setItem("token", tokenValue);
          const savedToken = localStorage.getItem("token");
          
          if (!savedToken || savedToken === 'undefined' || savedToken === 'null') {
            setMessage("⚠️ Lỗi khi lưu token. Vui lòng thử lại.");
            setLoading(false);
            return;
          }
        } catch (storageError) {
          setMessage("⚠️ Lỗi khi lưu token vào localStorage");
          setLoading(false);
          return;
        }

        setUser(userData);
        setToken(tokenValue);
        navigate("/");
      } else {
        setMessage("⚠️ Đăng ký / đăng nhập Google thất bại");
      }
    } catch (err) {
      setMessage("⚠️ Lỗi khi đăng nhập bằng Google: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setMessage("⚠️ Không thể kết nối Google, vui lòng thử lại!");
  };

  return (
    <div className="login-page-wrapper">
      <div className="register-container">
        <Link to="/" className="home-button">
          <FaHome className="home-icon" />
          <span>Về trang chủ</span>
        </Link>
        <div className="register-card">
          <div className="register-header">
            <div className="login-icon-wrapper">
              <FaUserPlus />
            </div>
            <h1>Đăng ký tài khoản</h1>
            <p>Tạo tài khoản để trải nghiệm tốt hơn</p>
          </div>

          {message && (
            <div className={`register-message ${message.startsWith("⚠️") ? "error" : "success"}`} role="alert">
              <span className="error-icon">{message.startsWith("⚠️") ? "⚠️" : "✓"}</span>
              <span className="error-text">{message.replace(/^⚠️\s*/, '').replace(/^✓\s*/, '')}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-group">
              <div className="input-wrapper">
                <FaUser className="input-icon" />
                <input
                  type="text"
                  placeholder="Tên hiển thị"
                  value={form.name}
                  required
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={loading}
                  className="login-input"
                />
              </div>
            </div>
            <div className="form-group">
              <div className="input-wrapper">
                <FaEnvelope className="input-icon" />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  required
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={loading}
                  className="login-input"
                />
              </div>
            </div>
            <div className="form-group">
              <div className="input-wrapper">
                <FaLock className="input-icon" />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={form.password}
                  required
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  disabled={loading}
                  className="login-input"
                />
              </div>
            </div>
            <button type="submit" className="register-button" disabled={loading}>
              {loading ? (
                <span className="button-loading">
                  <span className="spinner"></span>
                  <span>Đang xử lý...</span>
                </span>
              ) : (
                <>
                  <FaUserPlus className="button-icon" />
                  <span>Đăng ký</span>
                </>
              )}
            </button>
          </form>

          <div className="register-divider">
            <span className="divider-text">Hoặc</span>
          </div>

          <div className="google-login-wrapper">
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} disabled={loading} />
          </div>

          <p className="register-footer">
            Đã có tài khoản?{' '}
            <Link to="/login" className="register-link">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;