import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

const Layout = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-primary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold">
              HANSA Agriculture
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/catalog" className="hover:text-gray-200">Catalog</Link>
              <Link to="/orders" className="hover:text-gray-200">Orders</Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="hover:text-gray-200">Admin</Link>
              )}
              {user?.role === 'dealer' && (
                <Link to="/dealer" className="hover:text-gray-200">Dealer</Link>
              )}
              <Link to="/cart" className="relative hover:text-gray-200">
                Cart
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Link>
              {user ? (
                <div className="flex items-center gap-4">
                  <Link to="/profile" className="hover:text-gray-200">{user.name || user.phone}</Link>
                  <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">
                    Logout
                  </button>
                </div>
              ) : (
                <Link to="/login" className="bg-white text-primary px-4 py-2 rounded hover:bg-gray-100">
                  Login
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="bg-secondary text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2026 HANSA Agriculture. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;