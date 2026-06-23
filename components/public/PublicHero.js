import Link from "next/link";
import styles from "./PublicHero.module.css";

export default function PublicHero({ title = "Amarta Residence • Blok E", description, showManagerLink = true, className = "" }) {
  return (
    <header className={`hero-header timeline-hero public-hero ${styles.hero} ${className}`.trim()}>
      <h1 className="hero-title">{title}</h1>
      <p className="hero-desc">{description}</p>
      {showManagerLink ? (
        <Link href="/login" className={styles.managerLink} aria-label="Masuk Area Pengurus">
          🔐 Area Pengurus
        </Link>
      ) : null}
    </header>
  );
}
