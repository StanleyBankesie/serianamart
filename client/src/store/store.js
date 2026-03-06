import { configureStore, combineReducers } from "@reduxjs/toolkit";
import inventoryRefReducer from "./inventoryRefSlice";
import customersReducer from "../modules/customers/customerSlice.js";
import loadingReducer from "./ui/loadingSlice.js";
import notificationsReducer from "./ui/notificationsSlice.js";
import modalsReducer from "./ui/modalsSlice.js";
import refreshReducer from "./ui/refreshSlice.js";

export const store = configureStore({
  reducer: {
    inventoryRef: inventoryRefReducer,
    entities: combineReducers({
      customers: customersReducer,
    }),
    ui: combineReducers({
      loading: loadingReducer,
      notifications: notificationsReducer,
      modals: modalsReducer,
      refresh: refreshReducer,
    }),
  },
});
