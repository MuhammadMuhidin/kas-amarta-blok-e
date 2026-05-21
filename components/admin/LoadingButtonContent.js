export default function LoadingButtonContent({
  loading,
  loadingText,
  children,
}) {
  if (!loading) return children;

  const onlySpinner = !loadingText;

  return (
    <span
      style={{
        width: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: onlySpinner ? 0 : 8,
      }}
    >
      <svg
        width={onlySpinner ? "20" : "14"}
        height={onlySpinner ? "20" : "14"}
        viewBox="0 0 24 24"
        role="img"
        aria-label="Loading"
        style={{
          flexShrink: 0,
          display: "block",
        }}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth={onlySpinner ? "3.5" : "3"}
          opacity="0.25"
        />

        <path
          d="M21 12a9 9 0 0 0-9-9"
          fill="none"
          stroke="currentColor"
          strokeWidth={onlySpinner ? "3.5" : "3"}
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </path>
      </svg>

      {!onlySpinner && <span>{loadingText}</span>}
    </span>
  );
}
