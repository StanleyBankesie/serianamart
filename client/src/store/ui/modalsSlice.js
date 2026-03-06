import { createSlice } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "modals",
  initialState: {},
  reducers: {
    openModal(state, action) {
      const { key, props } = action.payload || {};
      if (!key) return;
      state[key] = { open: true, props: props || {} };
    },
    closeModal(state, action) {
      const key = action.payload;
      if (!key) return;
      state[key] = { open: false, props: {} };
    },
  },
});

export const { openModal, closeModal } = slice.actions;
export default slice.reducer;
