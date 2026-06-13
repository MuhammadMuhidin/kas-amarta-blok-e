import PublicHero from "@/components/public/PublicHero";
import PublicRouteSkeleton from "@/components/public/PublicRouteSkeleton";

export default function KasLoadingView() {
  return (
    <div className="page-wrap">
      <PublicHero
        description={(
          <>
            Pusat transparansi iuran, pengeluaran,
            <br />
            dan laporan kas warga.
          </>
        )}
      />
      <PublicRouteSkeleton variant="kas" includeHero={false} />
    </div>
  );
}
