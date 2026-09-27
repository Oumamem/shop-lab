@auth
Feature: Authentication
  As a shopper
  I want to sign in, stay signed in and sign out
  So that my account and orders are protected

  Scenario: Successful login shows a welcome message
    Given I am on the login page
    When I log in as "user@shoplab.test" with password "Password123!"
    Then I should see the toast "Welcome back, Uma User!"
    And the header should show the signed-in user "Uma User"

  Scenario: Submitting an empty login form shows field errors
    Given I am on the login page
    When I submit the login form without filling it in
    Then I should see the field error "Email is required"
    And I should see the field error "Password is required"

  Scenario Outline: Login is rejected with <case>
    Given I am on the login page
    When I log in as "<email>" with password "<password>"
    Then I should see the login error "<message>"

    Examples:
      | case             | email               | password     | message                                                                                       |
      | a wrong password | user@shoplab.test   | WrongPass1   | Invalid email or password. 2 attempts left.                                                   |
      | an unknown email | nobody@shoplab.test | Password123! | Invalid email or password.                                                                    |
      | a locked account | locked@shoplab.test | Password123! | Your account has been locked after too many failed attempts. Reset your password to unlock it. |

  Scenario: The account is locked after three failed attempts
    Given I am on the login page
    When I fail to log in as "jane@shoplab.test" 3 times
    Then I should see the login error "Your account has been locked after too many failed attempts. Reset your password to unlock it."
    When I log in as "jane@shoplab.test" with password "Password123!"
    Then I should see the login error "Your account has been locked"

  Scenario: Requesting a password reset unlocks a locked account
    Given I am on the forgot password page
    When I request a password reset for "locked@shoplab.test"
    Then I should see the text "If an account exists for that email, we have sent a password reset link."
    When I am on the login page
    And I log in as "locked@shoplab.test" with password "Password123!"
    Then I should see the toast "Welcome back, Luke Locked!"

  Scenario: Users are sent back to the page they wanted after logging in
    When I open "/profile"
    Then the URL should contain "/login?redirect=%2Fprofile"
    And I should see the text "Please log in to continue."
    When I log in as "user@shoplab.test" with password "Password123!"
    Then I should be on "/profile"
    And I should see the heading "My profile"

  Scenario: "Remember me" keeps the session in localStorage
    Given I am on the login page
    When I log in as "user@shoplab.test" with password "Password123!" and "Remember me" checked
    Then the header should show the signed-in user "Uma User"
    And localStorage should have a value for "shoplab.token"
    And sessionStorage should not have a value for "shoplab.token"

  Scenario: Without "Remember me" the session only lives in sessionStorage
    Given I am on the login page
    When I log in as "user@shoplab.test" with password "Password123!"
    Then the header should show the signed-in user "Uma User"
    And sessionStorage should have a value for "shoplab.token"
    And localStorage should not have a value for "shoplab.token"

  Scenario: Logging out
    Given I am logged in as "user"
    And I open "/"
    When I click the "Log out" button
    Then I should see the toast "You have been logged out."
    And I should be on "/login"
    And the header should show the "Log in" link

  Scenario: A customer cannot open the admin area
    Given I am logged in as "user"
    When I open "/admin"
    Then I should see the heading "Access denied"
    And I should not see the "Admin" link in the header

  Scenario: An admin can open the admin area
    Given I am logged in as "admin"
    When I open "/admin"
    Then I should see the heading "Dashboard"

  Scenario: An expired session sends the user back to log in
    Given I am logged in as "user"
    And I open "/profile"
    And the profile page has loaded
    When my session expires on the server
    And I click the "Save changes" button
    Then the URL should contain "expired=1"
    And I should see the text "Your session has expired. Please log in again."
