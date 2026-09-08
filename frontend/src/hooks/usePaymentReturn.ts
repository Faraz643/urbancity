import { useEffect } from "react";

type PaymentNotice = { message: string; ok: boolean };
type ReadApi = (r: Response) => Promise<any>;

export function usePaymentReturn(
  api: string,
  authHeaders: () => Record<string, string>,
  readApi: ReadApi,
  setPaymentNotice: (notice: PaymentNotice | null) => void,
  loadAllActiveBillboards: () => Promise<void>,
) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get("booking");
    const orderId = params.get("order_id");
    if (params.get("payment") !== "return" || !bookingId || !localStorage.getItem("urbancity_token")) return;
    let cancelled = false;
    (async () => {
      try {
        const verifyUrl = api + "/api/payments/" + encodeURIComponent(bookingId) + "/verify" + (orderId ? "?order_id=" + encodeURIComponent(orderId) : "");
        const r = await fetch(verifyUrl, { headers: authHeaders() });
        const data = await readApi(r);
        if (cancelled) return;
        if (!r.ok) throw new Error(data.error || "Could not verify payment");
        if (data.paid) {
          setPaymentNotice({ message: "Payment successful. Your advertising space is now active.", ok: true });
          await loadAllActiveBillboards();
        } else {
          setPaymentNotice({
            message: data.providerStatus === "ACTIVE"
              ? "Payment is still pending confirmation. Please refresh in a moment."
              : data.providerStatus === "PROCESSING"
                ? "Payment is still being confirmed. Please refresh in a moment."
                : "Payment was not completed.",
            ok: false,
          });
        }
        window.history.replaceState({}, "", window.location.pathname);
      } catch (e: any) {
        if (!cancelled) setPaymentNotice({ message: e.message || "Could not verify payment", ok: false });
      }
    })();
    return () => { cancelled = true; };
  }, [api, authHeaders, loadAllActiveBillboards, readApi, setPaymentNotice]);
}
