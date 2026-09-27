@catalog
Feature: Product catalog
  As a shopper
  I want to search, filter and sort products
  So that I can quickly find what I am looking for

  Scenario: The catalog lists the first page of products
    When I open the catalog
    Then I should see 12 products
    And the results count should be "Showing 1–12 of 48 products"

  Scenario: Search waits until the shopper stops typing
    Given I open the catalog
    And I am recording product search requests
    When I type "headphones" into the product search
    Then I should see the products:
      | Wireless Headphones |
    And exactly 1 search request should have been sent for "headphones"
    And the URL should contain "q=headphones"

  Scenario: Searching for something that does not exist
    Given I open the catalog
    When I type "unicorn socks" into the product search
    Then I should see the empty state "No products found"
    When I click the "Clear filters" button
    Then I should see 12 products

  Scenario: Filtering by category
    Given I open the catalog
    When I tick the "Books" category
    Then every product should be in the "Books" category
    And the results count should be "Showing 1–8 of 8 products"

  Scenario: Filtering by several categories
    Given I open the catalog
    When I tick the "Books" category
    And I tick the "Toys" category
    Then the results count should be "Showing 1–12 of 16 products"
    And the URL should contain "category=Books%2CToys"

  Scenario: Filtering by maximum price
    Given I open the catalog
    When I set the "Maximum price" slider to 50
    Then the price range should read "$0 – $50"
    And every product should cost at most $50

  Scenario: Filtering by customer rating
    Given I open the catalog
    When I choose the "4 stars & up" rating filter
    Then every product should be rated at least 4

  Scenario Outline: Sorting with the native select by <order>
    Given I open the catalog
    When I sort by "<order>" using the native select
    Then the products request should include "sort=<value>"
    And the product prices should be sorted <direction>

    Examples:
      | order              | value      | direction  |
      | Price: low to high | price-asc  | ascending  |
      | Price: high to low | price-desc | descending |

  Scenario: Sorting with the custom dropdown keeps both controls in sync
    Given I open the catalog
    When I sort by "Price: high to low" using the custom dropdown
    Then the product prices should be sorted descending
    And the native sort select should show "price-desc"

  Scenario: The custom dropdown can be used with the keyboard
    Given I open the catalog
    When I open the custom sort dropdown with the keyboard and choose option number 2
    Then the custom sort dropdown should show "Price: low to high"
    And the product prices should be sorted ascending

  Scenario: Paging through results
    Given I open the catalog
    When I go to page 2
    Then the results count should be "Showing 13–24 of 48 products"
    And page 2 should be the current page
    And the URL should contain "page=2"
    When I click the "Previous" button
    Then the results count should be "Showing 1–12 of 48 products"

  Scenario: Infinite scroll loads more products as the shopper scrolls
    Given I open the catalog
    When I switch to "Infinite scroll" mode
    And I scroll to the bottom until all products are loaded
    Then the results count should be "Showing 48 of 48 products"
    And I should see the text "You've reached the end of the list."

  @mock
  Scenario: Skeleton loaders are shown while products load
    Given the products API responds after 2000 ms
    When I open "/products"
    Then I should see 6 skeleton loaders
    And the skeleton loaders should disappear
    And I should see 12 products

  @mock
  Scenario: An empty API response shows the empty state
    Given the products API returns no products
    When I open "/products"
    Then I should see the empty state "No products found"

  @mock
  Scenario: A server error shows a retry option
    Given the products API fails with status 500
    When I open "/products"
    Then I should see the catalog error message
    When the products API recovers
    And I click the "Try again" button
    Then I should see 12 products
