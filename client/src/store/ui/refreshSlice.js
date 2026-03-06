import { createSlice } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "refresh",
  initialState: {},
  reducers: {
    setRefresh(state, action) {
      const { key, id, ts } = action.payload || {};
      if (!key) return;
      state[key] = { id: id ?? null, ts: ts ?? Date.now() };
    },
    consumeRefresh(state, action) {
      const key = action.payload;
      if (key && Object.prototype.hasOwnProperty.call(state, key)) {
        delete state[key];
      }
    },
  },
});

export const { setRefresh, consumeRefresh } = slice.actions;
export default slice.reducer;
