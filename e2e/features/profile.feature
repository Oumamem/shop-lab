@profile
Feature: User profile
  As a customer
  I want to manage my account
  So that my details stay up to date

  Background:
    Given I am logged in as "user"
    And I open "/profile"
    And the profile page has loaded

  Scenario: Editing personal details
    When I fill "Full name" with "Uma Updated"
    And I click the "Save changes" button
    Then I should see the text "Your profile has been saved."
    And the header should show the signed-in user "Uma Updated"

  Scenario: Uploading a valid avatar
    When I upload the avatar "me.png" of type "image/png"
    Then I should see the text "Your avatar has been updated."
    And my avatar image should be visible

  Scenario Outline: Rejecting an invalid avatar - <case>
    When I upload the avatar "<file>" of type "<type>" and size <size> bytes
    Then I should see the avatar error "<message>"

    Examples:
      | case           | file      | type       | size    | message                                   |
      | wrong type     | notes.txt | text/plain | 100     | Only PNG, JPG or WebP images are allowed. |
      | file too large | huge.png  | image/png  | 3000000 | The image must be 2 MB or smaller.        |

  Scenario: Changing the password with the wrong current password
    When I change my password from "NotMyPassword1" to "NewPassw0rd!"
    Then I should see the field error "Your current password is incorrect"

  Scenario: Changing the password
    When I change my password from "Password123!" to "NewPassw0rd!"
    Then I should see the text "Your password has been changed."
    And "user@shoplab.test" should be able to log in with "NewPassw0rd!"

  Scenario: Viewing the order history
    Then the order history should list:
      | order    | status    |
      | ORD-1003 | pending   |
      | ORD-1008 | delivered |
      | ORD-1002 | shipped   |
      | ORD-1001 | delivered |

  Scenario: Downloading an invoice
    When I download the invoice for "ORD-1001"
    Then the downloaded file should be named "invoice-ORD-1001.pdf"
    And the downloaded file should be a PDF

  Scenario: Cancelling account deletion keeps the account
    When I click "Delete account" and dismiss the confirmation
    Then the confirmation should have asked "Are you sure you want to delete your account? This cannot be undone."
    And I should be on "/profile"

  Scenario: Deleting the account
    When I click "Delete account" and accept the confirmation
    Then I should see the toast "Your account has been deleted."
    And "user@shoplab.test" should not be able to log in with "Password123!"
