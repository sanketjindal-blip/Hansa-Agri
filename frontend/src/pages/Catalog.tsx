import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, absoluteUrl, formatINR } from '../api/api';
import { useCart } from '../contexts/CartContext';

const Catalog = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          api.get('/products'),
          api.get('/categories'),
        ]);
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
      } catch (error) {
        console.error('Failed to fetch catalog:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category === selectedCategory)
    : products;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Product Catalog</h1>

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-full transition ${
            selectedCategory === '' ? 'bg-primary text-white' : 'bg-white text-gray-700'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-4 py-2 rounded-full transition ${
              selectedCategory === cat.key ? 'bg-primary text-white' : 'bg-white text-gray-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">Loading products...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <Link to={`/product/${product.id}`}>
                <img
                  src={absoluteUrl(product.image) || 'https://via.placeholder.com/300'}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              </Link>
              <div className="p-4">
                <Link to={`/product/${product.id}`}>
                  <h3 className="font-bold text-lg mb-2 hover:text-primary">{product.name}</h3>
                </Link>
                <p className="text-gray-600 text-sm mb-2">{product.category}</p>
                <p className="text-primary font-bold text-xl mb-3">{formatINR(product.price)}</p>
                <button
                  onClick={() => addToCart(product)}
                  className="w-full bg-primary text-white py-2 rounded hover:bg-yellow-600 transition"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Catalog;