@api
Feature: REST API
  API-only checks that run without a browser page

  Scenario: Listing products by category
    When I send a GET request to "/api/products?category=Books&delay=0"
    Then the response status should be 200
    And the response field "total" should be 8
    And the response field "items.0.category" should be "Books"

  Scenario: Requesting a product that does not exist
    When I send a GET request to "/api/products/9999?delay=0"
    Then the response status should be 404
    And the response field "error" should be "Product not found"

  Scenario: Logging in with bad credentials
    When I send a POST request to "/api/auth/login" with:
      """
      { "email": "user@shoplab.test", "password": "nope" }
      """
    Then the response status should be 401
    And the response field "code" should be "INVALID_CREDENTIALS"

  Scenario Outline: Admin endpoints are protected (<who>)
    Given I use an API token for "<who>"
    When I send a GET request to "/api/admin/stats"
    Then the response status should be <status>

    Examples:
      | who       | status |
      | anonymous | 401    |
      | user      | 403    |
      | admin     | 200    |

  Scenario: Validating an expired coupon
    When I send a POST request to "/api/coupons/validate" with:
      """
      { "code": "SUMMER20", "subtotal": 50 }
      """
    Then the response status should be 400
    And the response field "code" should be "COUPON_EXPIRED"

  Scenario: Orders cannot be delivered in the past
    Given I use an API token for "user"
    When I send a POST request to "/api/orders" with:
      """
      {
        "items": [{ "productId": 25, "qty": 1 }],
        "address": { "fullName": "Uma", "street": "1 St", "city": "Paris", "postalCode": "75001", "country": "France" },
        "shippingMethod": "standard",
        "deliveryDate": "2020-01-01",
        "payment": { "brand": "Visa", "last4": "4242", "token": "tok_test" }
      }
      """
    Then the response status should be 400
    And the response field "fields.deliveryDate" should be "Choose a delivery date in the future"

  Scenario: Resetting the database restores the seed data
    Given I use an API token for "admin"
    And I send a DELETE request to "/api/admin/products/1"
    When I send a POST request to "/api/reset" with:
      """
      {}
      """
    And I send a GET request to "/api/products/1?delay=0"
    Then the response status should be 200
    And the response field "name" should be "Wireless Headphones"
