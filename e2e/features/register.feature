@auth @register
Feature: Registration
  As a new visitor
  I want to create an account
  So that I can place orders

  Background:
    Given I am on the registration page

  Scenario: Successful registration signs the user in
    When I register with:
      | Full name        | New Tester              |
      | Email            | new.tester@shoplab.test |
      | Password         | Sup3rSecret!            |
      | Confirm password | Sup3rSecret!            |
      | terms            | accepted                |
    Then I should see the toast "Welcome to ShopLab, New Tester!"
    And the header should show the signed-in user "New Tester"

  Scenario Outline: Registration validation - <case>
    When I register with:
      | Full name        | Val Idation    |
      | Email            | <email>        |
      | Password         | <password>     |
      | Confirm password | <confirmation> |
      | terms            | <terms>        |
    Then I should see the field error "<message>"

    Examples:
      | case              | email               | password     | confirmation | terms        | message                                                                          |
      | invalid email     | not-an-email        | Sup3rSecret! | Sup3rSecret! | accepted     | Please enter a valid email address                                               |
      | weak password     | weak@shoplab.test   | password     | password     | accepted     | Password must be at least 8 characters and include uppercase, lowercase and a number |
      | password mismatch | mis@shoplab.test    | Sup3rSecret! | Different1!  | accepted     | Passwords do not match                                                           |
      | terms not ticked  | terms@shoplab.test  | Sup3rSecret! | Sup3rSecret! | not accepted | You must accept the terms and conditions                                         |
      | email taken       | user@shoplab.test   | Sup3rSecret! | Sup3rSecret! | accepted     | An account with this email already exists                                        |

  Scenario Outline: The password strength meter rates "<password>" as <strength>
    When I type "<password>" into the "Password" field
    Then the password strength should be "<strength>"

    Examples:
      | password          | strength |
      | abc               | Too weak |
      | abcdefgh          | Weak     |
      | Abcdefgh1         | Good     |
      | Sup3r$ecretPass!  | Strong   |
