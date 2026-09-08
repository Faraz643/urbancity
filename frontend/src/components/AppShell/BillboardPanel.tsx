import type { Billboard } from "../../types/billboard";
import { pricingCategory, type PricingConfig } from "../../pricing";

type Props = {
  selected: Billboard;
  active?: any;
  isOwner: boolean;
  companyName: string;
  siteUrl?: string;
  description: string;
  footfall: number;
  pricing: PricingConfig;
  pricingReady: boolean;
  bookingMinutes: number;
  bookingError: string;
  bookingBusy: boolean;
  uploadBusy: boolean;
  editMode: boolean;
  editBusy: boolean;
  removePhoto: boolean;
  bookingCompanyName: string;
  adTitle: string;
  adUrl: string;
  adFile: File | null;
  user: any;
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onBook: () => void;
  onMinutes: (minutes: number) => void;
  onStepMinutes: (delta: number) => void;
  setBookingCompanyName: (v: string) => void;
  setAdTitle: (v: string) => void;
  setAdUrl: (v: string) => void;
  setAdFile: (v: File | null) => void;
  setRemovePhoto: (v: boolean) => void;
  formatUsd: (v: number) => string;
  formatDuration: (m: number) => string;
  shortDate: (v: string) => string;
  remaining: (v?: string) => string;
};

const inputStyle = { width: "100%", boxSizing: "border-box" as const, marginTop: 8, padding: 9, borderRadius: 7, border: "1px solid #51627b", background: "#0a101a", color: "#fff" };
const linkStyle = { color: "#9fb0c8" };
const sepStyle = { color: "#526074" };

export function BillboardPanel(props: Props) {
  const { selected, active, isOwner, companyName, siteUrl, description, footfall, pricing, pricingReady, bookingMinutes, bookingError, bookingBusy, uploadBusy, editMode, editBusy, removePhoto, bookingCompanyName, adTitle, adUrl, adFile, user } = props;
  const category = pricingCategory(selected.type).toLowerCase() as "main" | "wall" | "corner";
  const categoryLabel = pricingCategory(selected.type) === "MAIN" ? "Main" : pricingCategory(selected.type) === "WALL" ? "Wall" : "Corner";
  return <div className="panel">
    <button className="close" onClick={props.onClose}>×</button>
    <h2>{siteUrl ? <a href={siteUrl} target="_blank" rel="noreferrer" className="company-link">{companyName} <span>↗</span></a> : companyName}</h2>
    <p>{description}</p>
    <div className="tag">{selected.traffic} Traffic</div>
    <div className="stat"><span>Footfall Till Date</span><b>{footfall}</b></div>
    {active && <><div className="stat"><span>Ends</span><b>{props.shortDate(active.endDate)}</b></div><div className="stat"><span>Time remaining</span><b>{props.remaining(active.endDate)}</b></div></>}

    {isOwner && <div style={{ margin: "12px 0" }}>
      {!editMode ? <button className="bid" onClick={props.onEdit}>Edit My Board</button> :
        <div style={{ padding: 10, border: "1px solid rgba(143,240,179,.35)", borderRadius: 10 }}>
          <b>Edit your active advertisement</b>
          <input value={bookingCompanyName} onChange={(e) => props.setBookingCompanyName(e.target.value)} placeholder="Company name" style={inputStyle} />
          <input value={adTitle} onChange={(e) => props.setAdTitle(e.target.value)} placeholder="Company description" style={inputStyle} />
          <input value={adUrl} onChange={(e) => props.setAdUrl(e.target.value)} placeholder="Website https://example.com" type="url" style={inputStyle} />
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { props.setAdFile(e.target.files?.[0] || null); props.setRemovePhoto(false); }} style={{ width: "100%", marginTop: 8 }} />
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input type="checkbox" checked={removePhoto} onChange={(e) => { props.setRemovePhoto(e.target.checked); if (e.target.checked) props.setAdFile(null); }} /> Remove photo and show text only
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="bid" onClick={props.onSave} disabled={editBusy}>{editBusy ? "Saving..." : "Save Changes"}</button>
            <button className="duration-step" onClick={props.onCancelEdit}>Cancel</button>
          </div>
        </div>}
    </div>}

    <div style={{ margin: "12px 0" }}>
      <b>Booking duration</b>
      <div className="duration-presets">
        {[60, 300, 540, 1440].map((minutes) => <button key={minutes} className={"duration-preset " + (bookingMinutes === minutes ? "active" : "")} onClick={() => props.onMinutes(minutes)}>
          <strong>{minutes === 1440 ? "1 day" : minutes / 60 + " hour" + (minutes === 60 ? "" : "s")}</strong>
          <small>{pricingReady ? props.formatUsd((pricing as any)[category]?.[minutes === 1440 ? "oneDay" : "per30"] * (minutes === 1440 ? 1 : minutes / 30)) : "Loading price…"}</small>
        </button>)}
      </div>
      <div className="duration-manual"><button className="duration-step" onClick={() => props.onStepMinutes(-30)}>−</button><b>{props.formatDuration(bookingMinutes)}</b><button className="duration-step" onClick={() => props.onStepMinutes(30)}>+</button></div>
      <small>Prices are controlled by the UrbanCity admin dashboard and refresh automatically.</small>
    </div>

    <div style={{ margin: "12px 0", padding: 10, border: "1px solid rgba(255,255,255,.12)", borderRadius: 10 }}>
      <b>Advertisement creative</b>
      <input value={bookingCompanyName} onChange={(e) => props.setBookingCompanyName(e.target.value)} placeholder="Company name" style={inputStyle} />
      <input value={adTitle} onChange={(e) => props.setAdTitle(e.target.value)} placeholder="Company description" style={inputStyle} />
      <input value={adUrl} onChange={(e) => props.setAdUrl(e.target.value)} placeholder="Website https://example.com" type="url" style={inputStyle} />
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => props.setAdFile(e.target.files?.[0] || null)} style={{ width: "100%", marginTop: 8 }} />
    </div>

    <div className="stat"><span>Fixed price</span><b>{pricingReady ? props.formatUsd((pricing as any)[category]?.per30 * (bookingMinutes / 30)) : "Loading…"}</b></div>
    <small>{pricingReady ? `${categoryLabel} boards: ${props.formatUsd((pricing as any)[category]?.per30)} / 30 min · ${props.formatUsd((pricing as any)[category]?.oneDay)} / day` : "Loading current pricing…"}</small>
    {bookingError && <p style={{ color: "#ff8f8f" }}>{bookingError}</p>}
    <button className="bid" onClick={props.onBook} disabled={bookingBusy || uploadBusy || !pricingReady}>{user ? bookingBusy || uploadBusy ? uploadBusy ? "Uploading..." : "Opening checkout..." : "Book & Pay" : "Login to Book"}</button>
    <div style={{ display: "flex", justifyContent: "center", gap: 9, flexWrap: "wrap", marginTop: 10, fontSize: 11 }}>
      <a href="/rules" style={linkStyle}>Rules</a><span style={sepStyle}>•</span><a href="/faq" style={linkStyle}>FAQ</a><span style={sepStyle}>•</span><a href="/terms" style={linkStyle}>Terms & Conditions</a><span style={sepStyle}>•</span><a href="/privacy" style={linkStyle}>Privacy</a><span style={sepStyle}>•</span><a href="/refund-policy" style={linkStyle}>Refunds</a>
    </div>
  </div>;
}
