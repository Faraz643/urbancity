import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Billboard, BidderInfo } from "../types/billboard";
import type { PricingConfig } from "../pricing";

type ReadApi = (r: Response) => Promise<any>;
type User = { id: string; displayName?: string; username?: string; websiteUrl?: string | null; } | null;

export function useBooking({
  api, selected, user, pricingReady, bookingMinutes, bookingCompanyName, adTitle, adUrl, adFile, removePhoto,
  setAuthOpen, setAuthError, setBookingError, setBookingBusy, setUploadBusy, setEditBusy, setActiveBookings, setBidders,
  setAdFile, setRemovePhoto, setEditMode, authHeaders, readApi, loadAllActiveBillboards, toAssetUrl,
}: {
  api: string;
  selected: Billboard | null;
  user: User;
  pricingReady: boolean;
  bookingMinutes: number;
  bookingCompanyName: string;
  adTitle: string;
  adUrl: string;
  adFile: File | null;
  removePhoto: boolean;
  setAuthOpen: Dispatch<SetStateAction<boolean>>;
  setAuthError: Dispatch<SetStateAction<string>>;
  setBookingError: Dispatch<SetStateAction<string>>;
  setBookingBusy: Dispatch<SetStateAction<boolean>>;
  setUploadBusy: Dispatch<SetStateAction<boolean>>;
  setEditBusy: Dispatch<SetStateAction<boolean>>;
  setActiveBookings: Dispatch<SetStateAction<Record<string, any>>>;
  setBidders: Dispatch<SetStateAction<Record<string, BidderInfo>>>;
  setAdFile: Dispatch<SetStateAction<File | null>>;
  setRemovePhoto: Dispatch<SetStateAction<boolean>>;
  setEditMode: Dispatch<SetStateAction<boolean>>;
  authHeaders: () => Record<string, string>;
  readApi: ReadApi;
  loadAllActiveBillboards: () => Promise<void>;
  toAssetUrl: (v?: string) => string | undefined;
}) {
  const uploadImageOnly = useCallback(async () => {
    if (!adFile) return undefined;
    const fd = new FormData();
    fd.append("file", adFile);
    const r = await fetch(api + "/api/advertisements/upload", { method: "POST", headers: authHeaders(), body: fd });
    const d = await readApi(r);
    if (!r.ok) throw new Error(d.error || "Upload failed");
    return d.imageUrl as string;
  }, [adFile, api, authHeaders, readApi]);

  const uploadCreative = useCallback(async () => {
    setUploadBusy(true);
    try {
      const imageUrl = await uploadImageOnly();
      if (!imageUrl && !adUrl.trim() && !adTitle.trim()) return null;
      const cr = await fetch(api + "/api/advertisements", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ title: bookingCompanyName || "Advertisement", description: adTitle || undefined, imageUrl: imageUrl || "", targetUrl: adUrl || user?.websiteUrl || undefined }),
      });
      const ad = await readApi(cr);
      if (!cr.ok) throw new Error(ad.error || "Could not create advertisement");
      return ad.id as string;
    } finally {
      setUploadBusy(false);
    }
  }, [adTitle, adUrl, api, authHeaders, bookingCompanyName, readApi, setUploadBusy, uploadImageOnly, user?.websiteUrl]);

  const book = useCallback(async () => {
    if (!selected) return;
    if (!user) {
      setAuthOpen(true);
      setAuthError("Login or register to book advertising space.");
      return;
    }
    if (!pricingReady) {
      setBookingError("Pricing is still loading. Please try again in a moment.");
      return;
    }
    setBookingError("");
    const link = adUrl.trim();
    if (link) {
      try { const u = new URL(link); if (!["http:", "https:"].includes(u.protocol)) throw new Error(); }
      catch { setBookingError("Please enter a valid website URL including https:// (for example: https://yourcompany.com)."); return; }
    }
    if (adFile && adFile.size > 5 * 1024 * 1024) {
      setBookingError("Your image is too large. Please choose a PNG, JPG or WEBP image smaller than 5 MB.");
      return;
    }
    setBookingBusy(true);
    try {
      const advertisementId = await uploadCreative();
      const r = await fetch(api + "/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ billboardId: selected.id, durationMinutes: bookingMinutes, companyName: bookingCompanyName || user.displayName || user.username, description: adTitle.trim() || undefined, advertisementId: advertisementId || undefined }),
      });
      const data = await readApi(r);
      if (!r.ok) throw new Error(data.error || "Could not start secure checkout");
      if (data.paymentProvider === "DODO" && data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      if (!data.paymentSessionId) throw new Error("Cashfree payment session was not returned");
      const Cashfree = (window as any).Cashfree;
      if (typeof Cashfree !== "function") throw new Error("Cashfree checkout is still loading. Please wait a moment and try again.");
      Cashfree({ mode: data.environment === "production" ? "production" : "sandbox" }).checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
    } catch (e: any) {
      setBookingError(e.message || "Booking failed");
    } finally {
      setBookingBusy(false);
    }
  }, [adFile, adTitle, adUrl, api, authHeaders, bookingCompanyName, bookingMinutes, pricingReady, readApi, selected, setAuthError, setAuthOpen, setBookingBusy, setBookingError, uploadCreative, user]);

  const saveCreative = useCallback(async () => {
    if (!selected || !user) return;
    setBookingError("");
    const link = adUrl.trim();
    if (link) {
      try { const u = new URL(link); if (!["http:", "https:"].includes(u.protocol)) throw new Error(); }
      catch { setBookingError("Please enter a valid website URL including https:// (for example: https://yourcompany.com)."); return; }
    }
    setEditBusy(true);
    try {
      const imageUrl = removePhoto ? null : await uploadImageOnly();
      const body: any = { companyName: bookingCompanyName.trim() || undefined, description: adTitle.trim(), targetUrl: adUrl.trim() };
      if (removePhoto) body.imageUrl = null; else if (imageUrl) body.imageUrl = imageUrl;
      const r = await fetch(api + "/api/bookings/" + encodeURIComponent(selected.id) + "/creative", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
      const data = await readApi(r);
      if (!r.ok) throw new Error(data.error || "Could not update creative");
      setActiveBookings((v) => ({ ...v, [selected.id]: data }));
      setBidders((v) => ({ ...v, [selected.id]: { name: data.companyName, amount: Number(data.amount || 0), siteUrl: data.targetUrl || data.siteUrl || undefined, imageUrl: toAssetUrl(data.imageUrl), description: data.description || undefined } }));
      setAdFile(null);
      setRemovePhoto(false);
      setEditMode(false);
      await loadAllActiveBillboards();
    } catch (e: any) {
      setBookingError(e.message || "Could not update creative");
    } finally {
      setEditBusy(false);
    }
  }, [adTitle, adUrl, api, authHeaders, bookingCompanyName, loadAllActiveBillboards, readApi, removePhoto, selected, setActiveBookings, setAdFile, setBidders, setEditBusy, setEditMode, setRemovePhoto, setBookingError, toAssetUrl, uploadImageOnly, user]);

  return { uploadImageOnly, uploadCreative, book, saveCreative };
}
