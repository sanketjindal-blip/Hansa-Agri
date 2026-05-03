import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <div className="text-center py-12">Please login to view profile</div>;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4">
          <label className="text-gray-600 text-sm">Name</label>
          <p className="text-lg font-semibold">{user.name || 'Not set'}</p>
        </div>
        <div className="mb-4">
          <label className="text-gray-600 text-sm">Phone</label>
          <p className="text-lg font-semibold">{user.phone}</p>
        </div>
        <div className="mb-4">
          <label className="text-gray-600 text-sm">Role</label>
          <p className="text-lg font-semibold capitalize">{user.role}</p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition"
      >
        Logout
      </button>
    </div>
  );
};

export default Profile;