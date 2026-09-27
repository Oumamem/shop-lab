@cart @checkout
Feature: Cart and checkout
  As a shopper
  I want to review my cart and pay for it
  So that my order is delivered

  Scenario: The cart shows line totals and the order summary
    Given my cart contains:
      | product             | qty |
      | The Testing Mindset | 2   |
    When I open "/cart"
    Then the order summary should show:
      | subtotal | $49.98 |
      | shipping | $5.99  |
      | total    | $55.97 |

  Scenario: Changing the quantity recalculates the totals
    Given my cart contains:
      | product             | qty |
      | The Testing Mindset | 2   |
    And I open "/cart"
    When I change the quantity of "The Testing Mindset" to 3
    Then the order summary should show:
      | subtotal | $74.97 |
      | total    | $80.96 |

  Scenario: Orders over $100 ship for free
    Given my cart contains:
      | product             | qty | color |
      | The Testing Mindset | 1   |       |
      | Wireless Headphones | 1   | Black |
    When I open "/cart"
    Then the order summary should show:
      | subtotal | $124.98 |
      | shipping | Free    |
      | total    | $124.98 |
    And I should see the text "You qualify for free standard shipping!"

  Scenario: Removing the last item empties the cart
    Given my cart contains:
      | product             | qty |
      | The Testing Mindset | 1   |
    And I open "/cart"
    When I remove "The Testing Mindset" from the cart
    Then I should see the heading "Your cart is empty"
    And the stored cart should be empty

  Scenario: The cart survives a page reload
    Given I am viewing product 25
    When I click the "Add to cart" button
    And I open "/cart"
    And I reload the page
    Then the cart should contain "The Testing Mindset"
    And the stored cart should contain "The Testing Mindset"

  Scenario Outline: Applying the coupon "<code>"
    Given my cart contains:
      | product             | qty |
      | The Testing Mindset | 2   |
    And I open "/cart"
    When I apply the coupon "<code>"
    Then I should see the text "<message>"

    Examples:
      | code     | message                                    |
      | SAVE10   | Coupon SAVE10 applied: 10% off your order. |
      | save10   | Coupon SAVE10 applied: 10% off your order. |
      | WELCOME5 | Coupon WELCOME5 applied: $5 off orders over $20. |
      | SUMMER20 | This coupon has expired.                   |
      | BOGUS    | This coupon code is not valid.             |

  Scenario Outline: The coupon "<code>" changes the totals
    Given my cart contains:
      | product             | qty |
      | The Testing Mindset | 2   |
    And I open "/cart"
    When I apply the coupon "<code>"
    Then the order summary should show:
      | shipping | <shipping> |
      | total    | <total>    |

    Examples:
      | code     | shipping | total  |
      | SAVE10   | $5.99    | $50.97 |
      | WELCOME5 | $5.99    | $50.97 |
      | FREESHIP | Free     | $49.98 |

  Scenario: Checkout requires an account
    Given my cart contains:
      | product             | qty |
      | The Testing Mindset | 1   |
    When I open "/checkout"
    Then the URL should contain "/login?redirect=%2Fcheckout"

  Scenario: The address step validates required fields
    Given I am logged in as "user"
    And my cart contains:
      | product             | qty |
      | The Testing Mindset | 1   |
    And I open "/checkout"
    When I click the "Continue to shipping" button
    Then I should see the field errors:
      | Street address is required |
      | City is required           |
      | Postal code is required    |
      | Please select a country    |

  Scenario: Past delivery dates cannot be picked
    Given I am logged in as "user"
    And my cart contains:
      | product             | qty |
      | The Testing Mindset | 1   |
    And I am on the shipping step of checkout
    When I open the delivery date picker
    Then the date 0 days from today should be disabled
    And the date 1 days from today should be enabled
    When I press "Escape"
    Then the delivery date picker should be closed

  Scenario: A complete purchase with express shipping
    Given I am logged in as "user"
    And my cart contains:
      | product             | qty |
      | The Testing Mindset | 2   |
    When I open "/checkout"
    And I fill in the shipping address:
      | Street address | 1 Rue du Test |
      | City           | Paris         |
      | Postal code    | 75001         |
      | Country        | France        |
    And I click the "Continue to shipping" button
    And I choose "Express" shipping
    And I pick the delivery date 3 days from today
    And I click the "Continue to payment" button
    And I pay with card "4242 4242 4242 4242" expiring "12/30" with CVC "123"
    Then I should see the saved card ending in "4242"
    When I click the "Review order" button
    Then I should see the heading "Review your order"
    When I place the order
    Then I should see the heading "Thank you for your order!"
    And I should see an order number
    And the order total should be "$64.97"
    And the stored cart should be empty

  Scenario: The payment frame rejects an invalid card number
    Given I am logged in as "user"
    And my cart contains:
      | product             | qty |
      | The Testing Mindset | 1   |
    And I am on the payment step of checkout
    When I pay with card "4242 4242 4242 4241" expiring "12/30" with CVC "123"
    Then the payment frame should show the error "This card number is not valid"

  Scenario: A declined card is reported when placing the order
    Given I am logged in as "user"
    And my cart contains:
      | product             | qty |
      | The Testing Mindset | 1   |
    And I am on the payment step of checkout
    When I pay with card "4000 0000 0000 0002" expiring "12/30" with CVC "123"
    Then I should see the saved card ending in "0002"
    When I click the "Review order" button
    And I place the order
    Then I should see the order error "Your card was declined. Please use a different card."
