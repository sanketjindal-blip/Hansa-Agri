import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, absoluteUrl, formatINR } from '../api/api';
import { useCart } from '../contexts/CartContext';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data);
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!product) return <div className="text-center py-12">Product not found</div>;

  const handleAddToCart = () => {
    addToCart(product);
    navigate('/cart');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-6 text-primary hover:underline">
        &larr; Back
      </button>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <img
              src={absoluteUrl(product.image) || 'https://via.placeholder.com/500'}
              alt={product.name}
              className="w-full rounded-lg"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            <p className="text-gray-600 mb-2">Category: {product.category}</p>
            <p className="text-primary font-bold text-4xl mb-6">{formatINR(product.price)}</p>
            
            {product.description && (
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2">Description</h2>
                <p className="text-gray-700">{product.description}</p>
              </div>
            )}

            {product.features && (
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2">Features</h2>
                <ul className="list-disc list-inside text-gray-700">
                  {product.features.split('\n').map((feature: string, i: number) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleAddToCart}
                className="flex-1 bg-primary text-white py-3 rounded-lg font-bold hover:bg-yellow-600 transition"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;