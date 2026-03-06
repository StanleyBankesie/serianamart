import { createSlice, nanoid } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "notifications",
  initialState: [],
  reducers: {
    notify: {
      reducer(state, action) {
        state.push(action.payload);
      },
      prepare({ type = "info", message, duration = 4000 }) {
        return { payload: { id: nanoid(), type, message, duration } };
      },
    },
    dismiss(state, action) {
      const id = action.payload;
      return state.filter((n) => n.id !== id);
    },
    clear() {
      return [];
    },
  },
});

export const { notify, dismiss, clear } = slice.actions;
export default slice.reducer;
