@global
Feature: Global behaviour
  As any visitor
  I want the site to adapt to my preferences and situation

  Scenario: The theme follows the operating system preference
    Given my system prefers the "dark" colour scheme
    When I open "/"
    Then the page theme should be "dark"

  Scenario: The chosen theme is remembered
    Given my system prefers the "light" colour scheme
    And I open "/"
    When I click the "Switch to dark theme" button
    Then the page theme should be "dark"
    When I reload the page
    Then the page theme should be "dark"
    And localStorage "shoplab.theme" should be "dark"

  Scenario: Switching to Arabic uses a right-to-left layout
    Given I open "/products"
    When I choose the language "العربية"
    Then the page direction should be "rtl" with language "ar"
    And I should see the heading "تسوّق جميع المنتجات"
    When I reload the page
    Then the page direction should be "rtl" with language "ar"

  Scenario: Unknown pages show a 404
    When I open "/this-page-does-not-exist"
    Then I should see the heading "Page not found"

  Scenario: Losing the network connection shows an offline banner
    Given I open "/"
    When the browser goes offline
    Then I should see the text "You are offline. Some features may not work until your connection is restored."
    When the browser comes back online
    Then I should see the text "You are back online."

  @no-webkit
  Scenario: The skip link is the first focusable element
    Given I open "/"
    When I press "Tab"
    Then the "Skip to main content" link should have focus
    When I press "Enter"
    Then the main content should have focus

  @mobile
  Scenario: The navigation collapses into a hamburger menu on mobile
    Given I open "/"
    Then the main navigation links should be hidden
    When I click the "Menu" button
    Then the "Menu" button should be expanded
    When I click the "Shop" link
    Then I should be on "/products"
    And the main navigation links should be hidden

  @mobile
  Scenario: A mobile shopper can add a product to the cart
    Given I am viewing product 25
    When I click the "Add to cart" button
    Then the cart badge should show 1

  @a11y
  Scenario Outline: The <page> page has no serious accessibility violations
    When I open "<path>"
    Then the page should have no serious accessibility violations

    Examples:
      | page     | path              |
      | home     | /                 |
      | catalog  | /products         |
      | product  | /products/1       |
      | login    | /login            |
      | register | /register         |
      | cart     | /cart             |
      | 404      | /missing-page     |
