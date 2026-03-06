import { createSlice } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "loading",
  initialState: {},
  reducers: {
    setLoading(state, action) {
      const { key, value } = action.payload || {};
      if (!key) return;
      state[key] = !!value;
    },
    clearLoading(state, action) {
      const key = action.payload;
      if (key && Object.prototype.hasOwnProperty.call(state, key)) {
        delete state[key];
      }
    },
  },
});

export const { setLoading, clearLoading } = slice.actions;
export default slice.reducer;
