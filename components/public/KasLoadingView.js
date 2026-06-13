import PublicRouteSkeleton from "@/components/public/PublicRouteSkeleton";

export default function KasLoadingView() {
  return (
    <div className="page-wrap public-kas-page">
      <PublicRouteSkeleton variant="kas" includeHero={false} />
    </div>
  );
}
