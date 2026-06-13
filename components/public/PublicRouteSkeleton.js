import styles from "./PublicRouteSkeleton.module.css";

function HeroSkeleton() {
  return (
    <div className={styles.hero} aria-hidden="true">
      <span className={`${styles.line} ${styles.heroTitle}`} />
      <span className={`${styles.line} ${styles.heroText}`} />
      <span className={`${styles.line} ${styles.heroTextShort}`} />
      <span className={`${styles.block} ${styles.heroButton}`} />
    </div>
  );
}

function TimelineCardSkeleton() {
  return (
    <article className={styles.card} aria-hidden="true">
      <div className={styles.cardHeader}>
        <span className={`${styles.block} ${styles.avatar}`} />
        <div className={styles.stack}>
          <span className={`${styles.line} ${styles.textMid}`} />
          <span className={`${styles.line} ${styles.textShort}`} />
        </div>
      </div>
      <div className={styles.cardBody}>
        <span className={`${styles.line} ${styles.cardTitle}`} />
        <span className={`${styles.line} ${styles.textLong}`} />
        <span className={`${styles.line} ${styles.textMid}`} />
      </div>
      <span className={`${styles.block} ${styles.media}`} />
    </article>
  );
}

function HomeSkeleton() {
  return (
    <main className={styles.page} role="status" aria-label="Memuat halaman beranda">
      <HeroSkeleton />
      <div className={styles.storyRail} aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className={styles.story} key={index}>
            <span className={styles.circle} />
            <span className={`${styles.line} ${styles.storyText}`} />
          </div>
        ))}
      </div>
      <div className={styles.feed}>
        <TimelineCardSkeleton />
        <TimelineCardSkeleton />
      </div>
    </main>
  );
}

function KasSkeleton() {
  return (
    <main className={styles.page} role="status" aria-label="Memuat halaman kas warga">
      <HeroSkeleton />
      <div className={styles.tabs} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <span className={`${styles.block} ${styles.tab}`} key={index} />
        ))}
      </div>
      <div className={styles.summary} aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <span className={`${styles.block} ${styles.summaryItem}`} key={index} />
        ))}
      </div>
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 10 }).map((_, index) => (
          <span className={`${styles.block} ${styles.gridItem}`} key={index} />
        ))}
      </div>
    </main>
  );
}

function RequestCardSkeleton({ withPrice = false, fieldCount = 2 }) {
  return (
    <section className={styles.requestCard} aria-hidden="true">
      <div className={styles.requestHeader}>
        <div className={styles.requestCopy}>
          <span className={`${styles.line} ${styles.kicker}`} />
          <span className={`${styles.line} ${styles.heading}`} />
        </div>
        {withPrice ? <span className={`${styles.block} ${styles.pill}`} /> : null}
      </div>
      {Array.from({ length: fieldCount }).map((_, index) => (
        <div className={styles.fieldGroup} key={index}>
          <span className={`${styles.line} ${styles.fieldLabel}`} />
          <span className={`${styles.block} ${index === fieldCount - 1 && fieldCount > 2 ? styles.textarea : styles.field}`} />
        </div>
      ))}
      <span className={`${styles.block} ${styles.requestButton}`} />
    </section>
  );
}

function PengajuanSkeleton() {
  return (
    <main className={`${styles.page} ${styles.requestList}`} role="status" aria-label="Memuat halaman pengajuan">
      <RequestCardSkeleton fieldCount={1} />
      <RequestCardSkeleton withPrice fieldCount={3} />
    </main>
  );
}

export default function PublicRouteSkeleton({ variant = "home" }) {
  if (variant === "kas") return <KasSkeleton />;
  if (variant === "pengajuan") return <PengajuanSkeleton />;
  return <HomeSkeleton />;
}
