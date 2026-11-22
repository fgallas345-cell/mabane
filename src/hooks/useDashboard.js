import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/fetchAll";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const since = (d) => d.toISOString();
      // Ventes comptées = ni annulées, ni devis (brouillon ou annulé) : même périmètre que Finances
      const counted = (q) =>
        q.neq("status", "annulee").eq("quote_status", "confirmed");

      const [
        salesTodayCount,
        salesMonthCount,
        paymentsMonth,
        products,
        expensesMonth,
        saleItemsMonth,
        smallSalesMonth,
        smallSaleItemsMonth,
      ] = await Promise.all([
        counted(
          supabase
            .from("sales")
            .select("id", { count: "exact", head: true })
            .gte("created_at", since(startOfToday)),
        ),
        counted(
          supabase
            .from("sales")
            .select("id", { count: "exact", head: true })
            .gte("created_at", since(startOfMonth)),
        ),
        // Encaissements réels, datés du jour du paiement (les remboursements sont négatifs)
        fetchAll(() =>
          supabase
            .from("payments")
            .select("amount, created_at")
            .gte("created_at", since(startOfMonth))
            .order("created_at"),
        ),
        fetchAll(() =>
          supabase
            .from("products")
            .select("id, name, stock, alert_threshold, sale_price")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("expenses")
            .select("amount, created_at")
            .gte("created_at", since(startOfMonth))
            .order("created_at"),
        ),
        // Marge sur les quantités facturées, comme la page Finances
        fetchAll(() =>
          supabase
            .from("sale_items")
            .select(
              "id, product_name, quantity, unit_price, purchase_price, line_total, sales!inner(id, created_at, discount, status, quote_status)",
            )
            .gte("sales.created_at", since(startOfMonth))
            .neq("sales.status", "annulee")
            .eq("sales.quote_status", "confirmed")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("small_sales")
            .select("id, total, created_at")
            .gte("created_at", since(startOfMonth))
            .is("cancelled_at", null)
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("small_sale_items")
            .select(
              "id, product_name, quantity, unit_price, purchase_price, line_total, small_sales!inner(id, created_at, discount, cancelled_at)",
            )
            .gte("small_sales.created_at", since(startOfMonth))
            .is("small_sales.cancelled_at", null)
            .order("id"),
        ),
      ]);

      if (salesTodayCount.error) throw salesTodayCount.error;
      if (salesMonthCount.error) throw salesMonthCount.error;

      const smallSalesToday = smallSalesMonth.filter(
        (s) => new Date(s.created_at) >= startOfToday,
      );
      const paymentsToday = paymentsMonth.filter(
        (p) => new Date(p.created_at) >= startOfToday,
      );

      const totalToday =
        paymentsToday.reduce((sum, p) => sum + Number(p.amount || 0), 0) +
        smallSalesToday.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const totalMonth =
        paymentsMonth.reduce((sum, p) => sum + Number(p.amount || 0), 0) +
        smallSalesMonth.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const totalExpensesMonth = expensesMonth.reduce(
        (sum, e) => sum + Number(e.amount),
        0,
      );
      const lowStock = products.filter(
        (p) => p.stock <= p.alert_threshold,
      );
      const discountBySale = new Map();
      const grossMarginMonth = saleItemsMonth.reduce((sum, item) => {
        const saleId = item.sales?.id;
        const discount = Number(item.sales?.discount || 0);
        if (saleId && !discountBySale.has(saleId))
          discountBySale.set(saleId, discount);
        return (
          sum +
          (Number(item.unit_price || 0) - Number(item.purchase_price || 0)) *
            Number(item.quantity || 0)
        );
      }, 0);
      // Marges des petites ventes + remises
      const smallDiscountBySale = new Map();
      const smallMarginMonth = smallSaleItemsMonth.reduce((sum, item) => {
        const saleId = item.small_sales?.id;
        const discount = Number(item.small_sales?.discount || 0);
        if (saleId && !smallDiscountBySale.has(saleId))
          smallDiscountBySale.set(saleId, discount);
        return (
          sum +
          (Number(item.unit_price || 0) - Number(item.purchase_price || 0)) *
            Number(item.quantity || 0)
        );
      }, 0);
      const totalDiscountMonth =
        Array.from(discountBySale.values()).reduce(
          (sum, discount) => sum + discount,
          0,
        ) +
        Array.from(smallDiscountBySale.values()).reduce(
          (sum, discount) => sum + discount,
          0,
        );

      const grossMargin =
        grossMarginMonth + smallMarginMonth - totalDiscountMonth;

      const productTotals = {};
      saleItemsMonth.forEach((item) => {
        if (!productTotals[item.product_name]) {
          productTotals[item.product_name] = {
            name: item.product_name,
            quantity: 0,
            revenue: 0,
          };
        }
        productTotals[item.product_name].quantity += item.quantity;
        productTotals[item.product_name].revenue += Number(item.line_total);
      });
      smallSaleItemsMonth.forEach((item) => {
        if (!productTotals[item.product_name]) {
          productTotals[item.product_name] = {
            name: item.product_name,
            quantity: 0,
            revenue: 0,
          };
        }
        productTotals[item.product_name].quantity += item.quantity;
        productTotals[item.product_name].revenue += Number(item.line_total);
      });
      const topProducts = Object.values(productTotals)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      return {
        salesTodayCount: (salesTodayCount.count || 0) + smallSalesToday.length,
        totalToday,
        salesMonthCount: (salesMonthCount.count || 0) + smallSalesMonth.length,
        totalMonth,
        totalExpensesMonth,
        grossMarginMonth: grossMargin,
        profitMonth: grossMargin - totalExpensesMonth,
        lowStock,
        topProducts,
        totalProducts: products.length,
      };
    },
    refetchInterval: 60000,
  });
}

// Requête légère pour la cloche de notifications (Topbar) : évite de recharger
// les 10 requêtes du tableau de bord sur chaque page.
export function useLowStock() {
  return useQuery({
    queryKey: ["products", "low-stock"],
    queryFn: async () => {
      const data = await fetchAll(() =>
        supabase
          .from("products")
          .select("id, name, stock, alert_threshold, unit")
          .order("stock", { ascending: true })
          .order("id", { ascending: true }),
      );
      return data.filter((p) => p.stock <= p.alert_threshold);
    },
    staleTime: 60 * 1000,
  });
}
