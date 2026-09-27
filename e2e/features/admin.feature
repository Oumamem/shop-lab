@admin
Feature: Admin dashboard
  As a store administrator
  I want to manage products and orders
  So that the store runs smoothly

  Background:
    Given I am logged in as "admin"

  Scenario: The dashboard shows key figures and charts
    When I open "/admin"
    Then the "orders" stat should be "8"
    And the "customers" stat should be "3"
    And the chart "Orders by status" should report "Pending: 2, Shipped: 2, Delivered: 4"
    And the chart "Revenue last 7 days" should be drawn on a canvas

  Scenario: Searching the products table
    Given I am on the admin products page
    When I search the products table for "mug"
    Then the products table should have 1 row
    And the product count should be "1 of 48 products"

  Scenario: Sorting the products table by price
    Given I am on the admin products page
    When I sort the products table by "Price"
    And I sort the products table by "Price"
    Then the "Price" column should be sorted "descending"
    And the first product row should contain "Gaming Mouse"

  Scenario: Editing a product inline
    Given I am on the admin products page
    When I edit the "Price" of "Ceramic Mug Set" to "12.50"
    Then I should see the toast "Saved Ceramic Mug Set."
    And the row for "Ceramic Mug Set" should contain "$12.50"

  Scenario: Inline edits are validated
    Given I am on the admin products page
    When I edit the "Price" of "Ceramic Mug Set" to "-1"
    Then I should see the text "Price must be a positive number"

  Scenario: Cancelling an inline edit with Escape
    Given I am on the admin products page
    When I start editing "Ceramic Mug Set" and press Escape
    Then the row for "Ceramic Mug Set" should contain "$64.99"

  Scenario: Creating a product
    Given I am on the admin products page
    When I click the "Add product" button
    And I fill the product form with:
      | Product name | Playwright Mug |
      | Category     | Home           |
      | Price (USD)  | 15             |
      | Stock        | 10             |
    And I click the "Create product" button
    Then I should see the toast "Created Playwright Mug."
    And the product count should be "49 of 49 products"

  Scenario: Deleting several products at once
    Given I am on the admin products page
    When I select the products:
      | Yoga Mat   |
      | Stunt Kite |
    And I click the "Delete selected (2)" button
    Then the dialog "Delete 2 products?" should be open
    When I confirm the deletion
    Then I should see the toast "Deleted 2 products."
    And the product count should be "46 of 46 products"

  Scenario: Exporting products as CSV
    Given I am on the admin products page
    When I click "Export CSV" and wait for the download
    Then the downloaded file should be named "products.csv"
    And the downloaded CSV should have the header "id,name,category,price,stock,description"
    And the downloaded CSV should have 48 data rows

  Scenario: Importing products from CSV
    Given I am on the admin products page
    When I import the CSV:
      """
      name,category,price,stock,description
      Imported Lamp,Home,29.99,5,A lamp
      Imported Ball,Sports,9.50,20,A ball
      Broken Row,Home,-3,1,Invalid price
      """
    Then the import result should say "Imported 2 new and updated 0 existing products."
    And the import result should say "Row 4: Price must be a positive number"
    And the product count should be "50 of 50 products"

  Scenario: Moving an order across the kanban board by drag and drop
    Given I open "/admin/orders"
    When I drag order "ORD-1004" to the "Shipped" column
    Then the "Shipped" column should contain order "ORD-1004"
    And the "Shipped" column count should be 3
    When I reload the page
    Then the "Shipped" column should contain order "ORD-1004"

  Scenario: Moving an order with the keyboard-friendly status menu
    Given I open "/admin/orders"
    When I set the status of "ORD-1003" to "Delivered"
    Then the "Delivered" column should contain order "ORD-1003"

  @realtime
  Scenario: New orders arrive in real time over the WebSocket
    Given I am monitoring the live updates WebSocket
    And I open "/admin/orders"
    And live updates are connected
    When another customer places an order
    Then a WebSocket message of type "order:new" should be received
    And I should see the toast "New order received"
    And the "Pending" column should contain the new order
