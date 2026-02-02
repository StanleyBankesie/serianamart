import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCategories as fetchCategoriesThunk } from "../store/inventoryRefSlice";

export function useItemCategories() {
  const dispatch = useDispatch();
  const categories = useSelector((s) => s.inventoryRef.categories);
  const status = useSelector((s) => s.inventoryRef.status.categories);
  const error = useSelector((s) => s.inventoryRef.error.categories);

  const refresh = useCallback(() => {
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  useEffect(() => {
    if (
      status === "idle" ||
      (status === "failed" &&
        (!Array.isArray(categories) || categories.length === 0))
    ) {
      dispatch(fetchCategoriesThunk());
    }
  }, [categories, dispatch, status]);

  return { categories, loading: status === "loading", error, refresh };
}
