import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { consumeRefresh } from "../store/ui/refreshSlice.js";

export function useAfterSaveRefresh(entityKey, fetchThunk) {
  const location = useLocation();
  const dispatch = useDispatch();
  useEffect(() => {
    const s = location.state && location.state.afterSave;
    if (!s || s.entity !== entityKey) return;
    dispatch(fetchThunk({ force: true }));
    const id = s.id || null;
    if (id) {
      setTimeout(() => dispatch(fetchThunk({ force: true })), 500);
    }
    try {
      window.history.replaceState({}, "");
    } catch {}
    dispatch(consumeRefresh(entityKey));
  }, [location.state, dispatch, entityKey, fetchThunk]);
}

export default useAfterSaveRefresh;
