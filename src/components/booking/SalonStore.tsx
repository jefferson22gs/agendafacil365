import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Plus, Minus, Package, ShoppingCart, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface SalonStoreProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onRemoveFromCart: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
}

export const SalonStore = ({
  products,
  cart,
  onAddToCart,
  onRemoveFromCart,
  onUpdateQuantity,
}: SalonStoreProps) => {
  const [showCart, setShowCart] = useState(false);

  const getQuantityInCart = (productId: string) => {
    const item = cart.find((i) => i.product.id === productId);
    return item?.quantity || 0;
  };

  const cartTotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Group products by category
  const categories = [...new Set(products.map((p) => p.category || "Outros"))];

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBag size={48} className="mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum produto disponível no momento</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cart Summary */}
      {cartItemsCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-10 bg-primary/10 backdrop-blur-xl rounded-2xl p-4 border border-primary/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <ShoppingCart size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {cartItemsCount} {cartItemsCount === 1 ? "item" : "itens"} no carrinho
                </p>
                <p className="text-sm text-muted-foreground">
                  Total: <span className="text-primary font-bold">R$ {cartTotal.toFixed(2)}</span>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCart(!showCart)}
            >
              {showCart ? "Ocultar" : "Ver itens"}
            </Button>
          </div>

          {/* Cart Items Dropdown */}
          <AnimatePresence>
            {showCart && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-border space-y-2"
              >
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        {item.product.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            className="w-full h-full rounded-lg object-cover"
                          />
                        ) : (
                          <Package size={16} className="text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          R$ {item.product.price.toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        R$ {(item.product.price * item.quantity).toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRemoveFromCart(item.product.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Products by Category */}
      {categories.map((category) => (
        <div key={category}>
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <ShoppingBag size={18} className="text-primary" />
            {category}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {products
              .filter((p) => (p.category || "Outros") === category)
              .map((product) => {
                const quantityInCart = getQuantityInCart(product.id);
                const isOutOfStock = product.stock <= 0;
                const maxReached = quantityInCart >= product.stock;

                return (
                  <Card
                    key={product.id}
                    className={`glass-card overflow-hidden ${
                      isOutOfStock ? "opacity-60" : ""
                    }`}
                  >
                    <div className="aspect-square bg-secondary/50 flex items-center justify-center relative">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={32} className="text-muted-foreground" />
                      )}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Badge variant="destructive">Esgotado</Badge>
                        </div>
                      )}
                      {quantityInCart > 0 && (
                        <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
                          {quantityInCart}x
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-medium text-foreground text-sm line-clamp-1">
                        {product.name}
                      </h4>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-primary">
                          R$ {product.price.toFixed(2)}
                        </p>
                        {!isOutOfStock && (
                          <div className="flex items-center gap-1">
                            {quantityInCart > 0 ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    onUpdateQuantity(
                                      product.id,
                                      quantityInCart - 1
                                    )
                                  }
                                >
                                  <Minus size={12} />
                                </Button>
                                <span className="w-6 text-center text-sm font-medium">
                                  {quantityInCart}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    onUpdateQuantity(
                                      product.id,
                                      quantityInCart + 1
                                    )
                                  }
                                  disabled={maxReached}
                                >
                                  <Plus size={12} />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="brand"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => onAddToCart(product)}
                              >
                                <Plus size={12} className="mr-1" />
                                Adicionar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
};
