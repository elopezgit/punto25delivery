// ─── CONFIGURACIÓN ───────────────────────────────────────────────
const WA_NUMBER = '+5493814767643';
// ─── CONFIGURACIÓN ───────────────────────────────────────────────

const MENU = [

  // ── PIZZAS ─────────────────────────────────────────────────────
  {
    id: 1,
    cat: 'pizzas',
    name: 'Muzzarella Clásica',
    desc: 'Nuestra icónica salsa de tomate artesanal, abundante mozzarella y orégano',
    price: 6500,
    img: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Pizza-3007395.jpg',
    emoji: '🍕',
    tags: ['vegetariana', 'popular'],
    hot: true,
    rating: 4.9
  },
  {
    id: 2,
    cat: 'pizzas',
    name: 'Napolitana Fuego',
    desc: 'Tomates frescos en rodajas, mozzarella fundida, ajo confitado y albahaca',
    price: 7200,
    img: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Neapolitan_pizza_at_Trappica_%2848701940197%29.jpg',
    emoji: '🍅',
    tags: ['vegetariana'],
    hot: false,
    rating: 4.8
  },
  {
    id: 3,
    cat: 'pizzas',
    name: 'Fugazzeta Rellena',
    desc: 'Doble masa rellena de jamón y queso, cubierta con cebolla caramelizada y parmesano',
    price: 8500,
    img: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Chicago-Style_Stuffed_Pizza.jpg',
    emoji: '🧅',
    tags: ['pop'],
    hot: true,
    rating: 5.0
  },
  {
    id: 4,
    cat: 'pizzas',
    name: 'Especial de la Casa',
    desc: 'Jamón cocido, morrones asados, aceitunas verdes, huevo duro picado y mozzarella',
    price: 8200,
    img: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Pizza-3007395.jpg',
    emoji: '⭐',
    tags: ['popular'],
    hot: false,
    rating: 4.7
  },
  {
    id: 5,
    cat: 'pizzas',
    name: 'Pepperoni NY Style',
    desc: 'Salsa de tomate especiada, doble mozzarella y abundantes rodajas de pepperoni crocante',
    price: 8900,
    img: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Neapolitan_pizza_at_Trappica_%2848701940197%29.jpg',
    emoji: '🗽',
    tags: ['spicy', 'pop'],
    hot: true,
    rating: 4.9
  },
  {
    id: 6,
    cat: 'pizzas',
    name: 'Rúcula y Jamón Crudo',
    desc: 'Mozzarella, base blanca. Horneada y coronada con rúcula fresca, jamón crudo y lluvia de parmesano',
    price: 9500,
    img: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Pizza-3007395.jpg',
    emoji: '🥬',
    tags: ['gourmet'],
    hot: false,
    rating: 4.8
  },
  {
    id: 7,
    cat: 'pizzas',
    name: 'Cuatro Quesos',
    desc: 'La mezcla perfecta: Mozzarella, provolone, roquefort y parmesano sobre salsa de tomate',
    price: 8700,
    img: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Chicago-Style_Stuffed_Pizza.jpg',
    emoji: '🧀',
    tags: ['vegetariana'],
    hot: false,
    rating: 4.6
  },
  {
    id: 8,
    cat: 'pizzas',
    name: 'Margarita Auténtica',
    desc: 'Masa fina, salsa de tomate natural, bocconcini de mozzarella di bufala y albahaca fresca',
    price: 7800,
    img: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Neapolitan_pizza_at_Trappica_%2848701940197%29.jpg',
    emoji: '🌿',
    tags: ['vegetariana'],
    hot: false,
    rating: 4.7
  },

  // ── EMPANADAS ──────────────────────────────────────────────────
  {
    id: 101,
    cat: 'empanadas',
    name: 'Carne Cortada a Cuchillo',
    desc: 'La tradicional tucumana. Carne en cubos, cebolla de verdeo, huevo duro y pimentón',
    price: 900,
    img: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Tapa_de_empanadillitas.JPG',
    emoji: '🥟',
    tags: ['popular', 'spicy'],
    hot: true,
    rating: 4.9
  },
  {
    id: 102,
    cat: 'empanadas',
    name: 'Jamón y Queso',
    desc: 'Clásica e infalible. Mucho jamón cocido y mozzarella derretida por dentro',
    price: 850,
    img: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Tapa_de_empanadillitas.JPG',
    emoji: '🧀',
    tags: ['kids'],
    hot: false,
    rating: 4.7
  },
  {
    id: 103,
    cat: 'empanadas',
    name: 'Pollo Suave',
    desc: 'Pollo desmenuzado cocinado lentamente con morrón dulce, cebolla y especias',
    price: 850,
    img: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Tapa_de_empanadillitas.JPG',
    emoji: '🍗',
    tags: [],
    hot: false,
    rating: 4.6
  },
  {
    id: 104,
    cat: 'empanadas',
    name: 'Humita Dulce',
    desc: 'Relleno cremoso de choclo amarillo rallado, zapallo, queso y una pizca de canela',
    price: 850,
    img: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Tapa_de_empanadillitas.JPG',
    emoji: '🌽',
    tags: ['vegetariana'],
    hot: false,
    rating: 4.5
  },
  {
    id: 105,
    cat: 'empanadas',
    name: 'Caprese',
    desc: 'Tomates secos hidratados, mozzarella, albahaca y un toque de aceite de oliva',
    price: 900,
    img: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Tapa_de_empanadillitas.JPG',
    emoji: '🍅',
    tags: ['vegetariana'],
    hot: false,
    rating: 4.8
  },
  {
    id: 106,
    cat: 'empanadas',
    name: 'Verdura y Salsa Blanca',
    desc: 'Espinaca fresca salteada con ajo, envuelta en salsa bechamel y queso parmesano',
    price: 850,
    img: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Tapa_de_empanadillitas.JPG',
    emoji: '🥬',
    tags: ['vegetariana'],
    hot: false,
    rating: 4.4
  },
  {
    id: 107,
    cat: 'empanadas',
    name: 'Roquefort y Apio',
    desc: 'Relleno de queso azul intenso, mozzarella suave y trocitos de apio crocante',
    price: 950,
    img: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Tapa_de_empanadillitas.JPG',
    emoji: '🧀',
    tags: ['fuerte'],
    hot: false,
    rating: 4.5
  },

  // ── BEBIDAS ────────────────────────────────────────────────────
  {
    id: 201,
    cat: 'bebidas',
    name: 'Coca-Cola Sabor Original 1.5L',
    desc: 'Botella de litro y medio, bien fría',
    price: 2500,
    img: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Coca_Cola_Flasche_-_Original_Taste.jpg',
    emoji: '🥤',
    tags: ['popular'],
    hot: true,
    rating: 4.9
  },
  {
    id: 202,
    cat: 'bebidas',
    name: 'Coca-Cola Zero 1.5L',
    desc: 'El mismo sabor original pero sin azúcar',
    price: 2500,
    img: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Coca_Cola_Flasche_-_Original_Taste.jpg',
    emoji: '🥤',
    tags: ['light'],
    hot: false,
    rating: 4.7
  },
  {
    id: 203,
    cat: 'bebidas',
    name: 'Sprite / 7UP 1.5L',
    desc: 'Refresco claro de lima limón, botella 1.5L',
    price: 2300,
    img: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Coca_Cola_Flasche_-_Original_Taste.jpg',
    emoji: '🍋',
    tags: [],
    hot: false,
    rating: 4.4
  },
  {
    id: 204,
    cat: 'bebidas',
    name: 'Cerveza Patagonia Amber Lager',
    desc: 'Lata 473ml. Cerveza ámbar con aroma a caramelo',
    price: 1800,
    img: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Real_Ale_2004-05-09_cropped.jpg',
    emoji: '🍺',
    tags: ['alcohol'],
    hot: false,
    rating: 4.8
  },
  {
    id: 205,
    cat: 'bebidas',
    name: 'Cerveza Stella Artois 1L',
    desc: 'Botella de litro retornable. Premium pilsner',
    price: 3200,
    img: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Real_Ale_2004-05-09_cropped.jpg',
    emoji: '🍻',
    tags: ['alcohol'],
    hot: false,
    rating: 4.9
  },
  {
    id: 206,
    cat: 'bebidas',
    name: 'Agua Mineral Kin',
    desc: 'Botella 500ml. Elegí con gas o sin gas al recibir',
    price: 1000,
    img: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Multi-use_water_bottle.JPG',
    emoji: '💧',
    tags: [],
    hot: false,
    rating: 4.3
  },

  // ── POSTRES ────────────────────────────────────────────────────
  {
    id: 301,
    cat: 'postres',
    name: 'Flan Casero con Dulce de Leche',
    desc: 'Receta de la abuela, extra cremoso, bañado en caramelo y con un copo de dulce de leche',
    price: 2200,
    img: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Cremecaramel.jpg',
    emoji: '🍮',
    tags: ['popular', 'pop'],
    hot: true,
    rating: 5.0
  },
  {
    id: 302,
    cat: 'postres',
    name: 'Chocotorta',
    desc: 'Clásica argentina. Galletitas de chocolate humedecidas en café, dulce de leche y crema',
    price: 2600,
    img: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Chocotorta_recipe.png',
    emoji: '🍰',
    tags: ['popular'],
    hot: true,
    rating: 4.9
  },
  {
    id: 303,
    cat: 'postres',
    name: 'Tiramisú Italiano',
    desc: 'Crema de mascarpone, vainillas al café y lluvia de cacao amargo',
    price: 2800,
    img: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Tiramisu_-_Raffaele_Diomede.jpg',
    emoji: '☕',
    tags: ['gourmet'],
    hot: false,
    rating: 4.8
  },
  {
    id: 304,
    cat: 'postres',
    name: 'Helado Artesanal 1/4 Kg',
    desc: 'Hasta 3 gustos a elección (Aclarar gustos en las notas del pedido)',
    price: 3500,
    img: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Ice_cream_with_whipped_cream%2C_chocolate_syrup%2C_and_a_wafer_%28cropped%29.jpg',
    emoji: '🍨',
    tags: [],
    hot: false,
    rating: 4.7
  },
  {
    id: 305,
    cat: 'postres',
    name: 'Cheesecake de Frutos Rojos',
    desc: 'Base de galleta crocante, crema de queso horneada y mermelada casera de frutos rojos',
    price: 2700,
    img: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Baked_cheesecake_with_raspberries_and_blueberries.jpg',
    emoji: '🍓',
    tags: [],
    hot: false,
    rating: 4.8
  }
];