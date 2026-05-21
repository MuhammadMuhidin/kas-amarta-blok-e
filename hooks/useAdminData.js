import { useMemo } from "react";

export default function useAdminData({
  personal,
  payments,
  cashflows,
  deposits,
}) {
  const totals = useMemo(() => {
    return {
      personal: personal.length,
      payments: payments.length,
      cashflows: cashflows.length,
      deposits: deposits.length,
    };
  }, [personal, payments, cashflows, deposits]);

  return {
    totals,
  };
}
