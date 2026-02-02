import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUoms } from "../store/inventoryRefSlice";

export const useUoms = (refreshTrigger = 0) => {
  const dispatch = useDispatch();
  const uoms = useSelector((s) => s.inventoryRef.uoms);
  const status = useSelector((s) => s.inventoryRef.status.uoms);
  const error = useSelector((s) => s.inventoryRef.error.uoms);

  useEffect(() => {
    if (status === "idle" || refreshTrigger) {
      dispatch(fetchUoms());
    }
  }, [dispatch, status, refreshTrigger]);

  const refresh = () => {
    dispatch(fetchUoms());
  };

  return { uoms, loading: status === "loading", error, refresh };
};
