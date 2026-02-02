import { configureStore } from "@reduxjs/toolkit";
import inventoryRefReducer from "./inventoryRefSlice";

export const store = configureStore({
  reducer: {
    inventoryRef: inventoryRefReducer,
  },
});

