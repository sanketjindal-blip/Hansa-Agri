import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, absoluteUrl } from '../api/api';

const Home = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await api.get('/products?featured=true');
        setProducts(res.data.slice(0, 6));
      } catch (error) {
        console.error('Failed to fetch featured products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  return (
    <div>
      <section className="bg-gradient-to-r from-primary to-yellow-500 text-white py-20 rounded-lg mb-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">HANSA Agriculture</h1>
          <p className="text-xl mb-8">Quality Machinery for Modern Farming</p>
          <Link to="/catalog" className="bg-white text-primary px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition">
            Browse Products
          </Link>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-3xl font-bold mb-6">Featured Products</h2>
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`} className="bg-white rounded-lg shadow-md hover:shadow-xl transition overflow-hidden">
                <img
                  src={absoluteUrl(product.image) || 'https://via.placeholder.com/300'}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-2">{product.category}</p>
                  <p className="text-primary font-bold text-xl">₹ {product.price?.toLocaleString('en-IN')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;