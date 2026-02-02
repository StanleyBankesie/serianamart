import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchItemTypes as fetchItemTypesThunk } from "../store/inventoryRefSlice";

export function useItemTypes() {
  const dispatch = useDispatch();
  const itemTypes = useSelector((s) => s.inventoryRef.itemTypes);
  const status = useSelector((s) => s.inventoryRef.status?.itemTypes);
  const error = useSelector((s) => s.inventoryRef.error?.itemTypes);

  const refresh = useCallback(() => {
    dispatch(fetchItemTypesThunk());
  }, [dispatch]);

  useEffect(() => {
    const hasData = Array.isArray(itemTypes) && itemTypes.length > 0;
    if (status == null) {
      dispatch(fetchItemTypesThunk());
      return;
    }
    if (status === "idle") {
      dispatch(fetchItemTypesThunk());
      return;
    }
    if (status === "failed" && !hasData) {
      dispatch(fetchItemTypesThunk());
    }
  }, [dispatch, itemTypes, status]);

  return { itemTypes, loading: status === "loading", error, refresh };
}
