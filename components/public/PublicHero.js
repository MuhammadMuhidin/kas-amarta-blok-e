import Link from "next/link";
import styles from "./PublicHero.module.css";

export default function PublicHero({ description, showManagerLink = true, className = "" }) {
  return (
    <header className={`hero-header timeline-hero public-hero ${styles.hero} ${className}`.trim()}>
      <div className="hero-eyebrow">Amarta Residence • Blok E</div>
      <p className="hero-desc">{description}</p>
      {showManagerLink ? (
        <Link href="/login" className={styles.managerLink} aria-label="Masuk Area Pengurus">
          🔐 Area Pengurus
        </Link>
      ) : null}
    </header>
  );
}
