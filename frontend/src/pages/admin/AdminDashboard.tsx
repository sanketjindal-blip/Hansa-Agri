const AdminDashboard = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-2">Total Products</h3>
          <p className="text-3xl font-bold text-primary">-</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-2">Total Orders</h3>
          <p className="text-3xl font-bold text-primary">-</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-2">Total Users</h3>
          <p className="text-3xl font-bold text-primary">-</p>
        </div>
      </div>
      <p className="mt-6 text-gray-600">Admin features coming soon...</p>
    </div>
  );
};

export default AdminDashboard;