@product
Feature: Product details
  As a shopper
  I want to inspect a product before buying it
  So that I choose the right variant

  Scenario: Switching gallery images with the thumbnails
    Given I am viewing product 1
    When I click thumbnail 3
    Then the main image should show view 3 of 4

  Scenario: Zooming an image and closing the dialog with Escape
    Given I am viewing product 1
    When I click the "Zoom image" button
    Then the dialog "Wireless Headphones – image 1" should be open
    When I press "Escape"
    Then no dialog should be open
    And the "Zoom image" button should have focus

  Scenario: Out-of-stock variants cannot be selected
    Given I am viewing product 9
    Then the following options should be disabled:
      | group  | value |
      | Size   | XS    |
      | Size   | XL    |
      | Colour | Red   |
    And the following options should be enabled:
      | group  | value |
      | Size   | M     |
      | Colour | Black |

  Scenario: A size must be chosen before adding to the cart
    Given I am viewing product 9
    When I click the "Add to cart" button
    Then I should see the product error "Please select a size."
    When I choose size "M"
    And I click the "Add to cart" button
    Then I should see the product error "Please select a colour."

  Scenario: The quantity stepper respects the available stock
    Given I am viewing product 1
    When I choose colour "Black"
    Then the decrease quantity button should be disabled
    When I increase the quantity 10 times
    Then the quantity should be 5
    And the increase quantity button should be disabled

  Scenario: Adding a product to the cart
    Given I am viewing product 9
    When I choose size "M"
    And I choose colour "Black"
    And I increase the quantity 1 times
    And I click the "Add to cart" button
    Then I should see the toast "Classic T-Shirt was added to your cart."
    And the cart badge should show 2

  Scenario: A sold-out product cannot be bought
    Given I am viewing product 46
    Then the "Out of stock" button should be disabled

  Scenario: Browsing the information tabs with the keyboard
    Given I am viewing product 1
    When I focus the "Description" tab and press "ArrowRight"
    Then the "Reviews" tab should be selected
    When I press "ArrowRight"
    Then the "Q&A" tab should be selected

  Scenario: Hovering the shipping icon shows a tooltip
    Given I am viewing product 1
    When I hover over the shipping information icon
    Then I should see the tooltip "Standard shipping is free for orders of $100.00 or more."

  Scenario: Sharing a product opens a new tab
    Given I am viewing product 1
    When I click "Share" and a new tab opens
    Then the new tab should be on "/share/1"
    And the new tab should show the heading "Share this product"

  Scenario: Asking a question requires logging in
    Given I am viewing product 1
    When I open the "Q&A" tab
    Then I should see the text "to ask a question."

  Scenario: A logged-in customer can ask a question
    Given I am logged in as "user"
    And I am viewing product 1
    When I open the "Q&A" tab
    And I fill "Ask a question" with "Does it come with a carrying case?"
    And I click the "Submit question" button
    Then I should see the text "Thanks! Your question has been posted."
    And I should see the text "Q: Does it come with a carrying case?"

  Scenario: An unknown product shows a not found page
    When I open "/products/9999"
    Then I should see the heading "Product not found"
