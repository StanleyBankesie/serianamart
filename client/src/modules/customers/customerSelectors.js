import { createSelector } from "@reduxjs/toolkit";
import { customerAdapter } from "./customerSlice.js";

const selectSlice = (state) => state.entities?.customers;

const baseSelectors = customerAdapter.getSelectors(selectSlice);

export const selectAllCustomers = baseSelectors.selectAll;
export const selectCustomerById = baseSelectors.selectById;
export const selectCustomerIds = baseSelectors.selectIds;
export const selectCustomersLoading = (state) =>
  state.entities?.customers?.loading;
export const selectCustomersError = (state) => state.entities?.customers?.error;

export const makeSelectCustomersBySearch = () =>
  createSelector(
    [selectAllCustomers, (_, term) => String(term || "").toLowerCase()],
    (items, term) =>
      items.filter((r) => {
        const code = String(r.customer_code || "").toLowerCase();
        const name = String(r.customer_name || "").toLowerCase();
        const email = String(r.email || "").toLowerCase();
        return (
          code.includes(term) || name.includes(term) || email.includes(term)
        );
      }),
  );
