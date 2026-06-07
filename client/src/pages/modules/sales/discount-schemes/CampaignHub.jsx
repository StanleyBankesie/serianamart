import React from "react";
import { Link } from "react-router-dom";
import "./DiscountSchemeList.css";

export default function CampaignHub() {
  return (
    <div className="promo-campaign-container">
      <header className="ds-header">
        <div className="ds-header-top">
          <div>
            <h1>🎯 Promotional Campaigns</h1>
            <p>Choose a campaign type to manage</p>
          </div>
          <div className="ds-header-actions">
            <Link to="/sales" className="ds-btn ds-btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
      </header>

      <div className="campaign-hub-grid">
        <Link to="/sales/discount-schemes/discount" className="campaign-hub-card">
          <div className="campaign-hub-icon">🏷️</div>
          <h2>Discount Campaign</h2>
          <p>Create percentage-based or fixed-amount discount campaigns. Set discount values, validity periods, and link items to offer targeted price reductions.</p>
          <span className="campaign-hub-btn">Manage Discount Campaigns →</span>
        </Link>

        <Link to="/sales/discount-schemes/bogo" className="campaign-hub-card campaign-hub-card-bogo">
          <div className="campaign-hub-icon">🎁</div>
          <h2>Purchase Reward Campaign</h2>
          <p>Create buy-one-get-one-free (BOGO) campaigns. Define purchase items, free reward items, and campaign-wide quantity limits that auto-expire when exhausted.</p>
          <span className="campaign-hub-btn">Manage BOGO Campaigns →</span>
        </Link>
      </div>
    </div>
  );
}
