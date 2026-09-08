type Props = {
  open: boolean;
  leaderboard: any[];
  onClose: () => void;
  formatUsd: (value: number) => string;
  durationLabel: (minutes: number) => string;
};

export function Leaderboard({ open, leaderboard, onClose, formatUsd, durationLabel }: Props) {
  if (!open) return null;
  return (
    <div className="leaderboard-overlay">
      <section className="leaderboard-window">
        <button className="leaderboard-close" onClick={onClose}>×</button>
        <div className="leaderboard-head">
          <span>URBANCITY</span>
          <h1>Leaderboard</h1>
          <p>Top advertisers by total spend</p>
        </div>
        <div className="leaderboard-list">
          {leaderboard.length === 0 ? (
            <div className="empty-state">No advertisers yet.</div>
          ) : (
            leaderboard.map((x: any) => (
              <article className="leaderboard-row" key={x.username + "-" + x.name}>
                <div className="rank">#{x.rank}</div>
                <div className="company-logo">
                  <img src={x.logo || "/company-placeholder.svg"} alt={x.name + " logo"} />
                </div>
                <div className="company-main">
                  <b>{x.name}</b>
                  <small style={{ fontSize: 12, opacity: 0.82, marginTop: 3 }}>
                    {x.description || "Company description"}
                  </small>
                </div>
                <div className="leaderboard-metric">
                  <small>Total paid</small>
                  <b>{formatUsd(Number(x.totalPayment))}</b>
                </div>
                <div className="leaderboard-metric">
                  <small>Total time</small>
                  <b>{durationLabel(x.totalMinutes)}</b>
                </div>
                <a className="site-link" href={x.siteUrl}>Site ↗</a>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
