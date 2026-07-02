"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/booking/track";

interface Props {
  txId: string; // folio o session_id: deduplica el evento
  value: number;
  itemNames: string[];
}

// Dispara el evento `purchase` (GA4 + Pixel del hotel) UNA sola vez por
// transacción, aunque el huésped recargue la página de confirmación.
export function PurchaseTracker({ txId, value, itemNames }: Props) {
  useEffect(() => {
    if (!txId || !(value > 0)) return;
    try {
      const key = `kora_purchase_${txId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* sin storage: dispara igual */
    }
    trackPurchase(
      txId,
      value,
      itemNames.map((n) => ({ item_id: n, item_name: n, quantity: 1 })),
    );
    // Solo al montar con una transacción concreta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId]);

  return null;
}
