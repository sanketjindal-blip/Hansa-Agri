import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { api, formatINR, formatApiError } from '../api/api';

const Checkout = () => {
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/orders/checkout', {
        items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      });
      clearCart();
      alert('Order placed successfully!');
      navigate('/orders');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">No items in cart</h2>
        <button onClick={() => navigate('/catalog')} className="bg-primary text-white px-6 py-3 rounded-lg">
          Go Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Checkout</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Order Summary</h2>
        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.name} x {item.quantity}
              </span>
              <span>{formatINR(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-4">
          <div className="flex justify-between font-bold text-xl">
            <span>Total</span>
            <span className="text-primary">{formatINR(totalPrice)}</span>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Place Order'}
      </button>
    </div>
  );
};

export default Checkout;