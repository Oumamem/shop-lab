@visual
Feature: Visual regression
  Screenshots are compared with the baselines in e2e/__screenshots__.
  Create or refresh them with: npm run test:visual -- --update-snapshots

  Scenario: The login page looks the same
    Given I am on the login page
    Then the page should match the screenshot "login-page.png"

  Scenario: The product gallery looks the same
    Given I am viewing product 1
    Then the main product image should match the screenshot "headphones-main-image.png"
