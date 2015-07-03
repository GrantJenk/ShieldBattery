import React from 'react'
import Card from '../material/card.jsx'
import { Checkbox, TextField, FlatButton } from 'material-ui'
import ValidatedForm from '../forms/validated-form.jsx'
import ValidatedText from '../forms/validated-text-input.jsx'
import composeValidators from '../forms/compose-validators'
import minLengthValidator from '../forms/min-length-validator'
import maxLengthValidator from '../forms/max-length-validator'
import regexValidator from '../forms/regex-validator'
import matchOtherValidator from '../forms/match-other-validator'
import constants from '../../shared/constants'
import authStore from './auth-store'
import auther from './auther'

class Signup extends React.Component {
  constructor() {
    super()
    this.authStoreListener = () => this.onAuthChange()
    this.state = {
      authChangeInProgress: false,
      reqId: null,
      failure: null,
    }
  }

  componentDidMount() {
    this.checkLoggedIn()
    authStore.register(this.authStoreListener)
  }

  componentWillUnmount() {
    authStore.unregister(this.authStoreListener)
  }

  checkLoggedIn() {
    if (authStore.isLoggedIn) {
      // We're logged in now, hooray!
      // Go wherever the user was intending to go before being directed here (or home)
      let nextPath = this.context.router.getCurrentQuery().nextPath || 'home'
      this.context.router.replaceWith(nextPath)
      return true
    }

    return false
  }

  onAuthChange() {
    if (this.checkLoggedIn()) return

    this.setState({
      authChangeInProgress: authStore.authChangeInProgress,
      failure: authStore.hasFailure(this.state.reqId) ? authStore.lastFailure.err : null
    })
  }

  render() {
    if (this.state.authChangeInProgress) {
      return <Card zDepth={1} className='card-form'><span>Please wait...</span></Card>
    }

    let button = (<FlatButton type='button' label='Sign up' secondary={true}
        onTouchTap={e => this.onSignUpClicked(e)} tabIndex={1}/>)

    let usernameValidator = composeValidators(
      minLengthValidator(constants.USERNAME_MINLENGTH,
          `Use at least ${constants.USERNAME_MINLENGTH} characters`),
      maxLengthValidator(constants.USERNAME_MAXLENGTH,
          `Use at most ${constants.USERNAME_MAXLENGTH} characters`),
      regexValidator(constants.USERNAME_PATTERN,
          `Username contains invalid characters`)
    )
    let emailValidator = composeValidators(
      minLengthValidator(constants.EMAIL_MINLENGTH,
          `Use at least ${constants.EMAIL_MINLENGTH} characters`),
      maxLengthValidator(constants.EMAIL_MAXLENGTH,
          `Use at most ${constants.EMAIL_MAXLENGTH} characters`),
      regexValidator(constants.EMAIL_PATTERN,
          `Enter a valid email address`)
    )
    let passwordValidator = minLengthValidator(constants.PASSWORD_MINLENGTH,
        `Use at least ${constants.PASSWORD_MINLENGTH} characters`)
    let confirmPasswordValidator = matchOtherValidator('password',
        `Passwords do not match`)

    return (
      <Card zDepth={1} className='card-form'>
        <ValidatedForm formTitle='Sign up'
            errorText={this.state.failure && this.state.failure.error}
            ref='form' buttons={button} onSubmitted={values => this.onSubmitted(values)}>
          <ValidatedText floatingLabelText='Username' name='username' tabIndex={1}
              defaultValue={this.context.router.getCurrentQuery().username}
              required={true} requiredMessage='Enter a username'
              validator={usernameValidator}
              onEnterKeyDown={e => this.onSignUpClicked()}/>
          <ValidatedText floatingLabelText='Email address' name='email' tabIndex={1}
              required={true} requiredMessage='Enter an email address'
              validator={emailValidator}
              onEnterKeyDown={e => this.onSignUpClicked()}/>
          <ValidatedText floatingLabelText='Password' name='password' tabIndex={1} type='password'
              required={true} requiredMessage='Enter a password'
              validator={passwordValidator}
              onEnterKeyDown={e => this.onSignUpClicked()}/>
          <ValidatedText floatingLabelText='Confirm password' name='confirmPassword' tabIndex={1}
              required={true} requiredMessage='Confirm your password' type='password'
              validator={confirmPasswordValidator}
              onEnterKeyDown={e => this.onSignUpClicked()}/>
        </ValidatedForm>
      </Card>
    )
  }

  onSignUpClicked() {
    this.refs.form.trySubmit()
  }

  onSubmitted(values) {
    let id = auther.signUp(values.get('username'), values.get('email'), values.get('password'))
    this.setState({
      reqId: id
    })
  }
}

Signup.contextTypes = {
  router: React.PropTypes.func
}

export default Signup