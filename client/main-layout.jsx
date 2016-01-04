import React from 'react'
import { connect } from 'react-redux'
import { replacePath } from 'redux-simple-router'
import { goToIndex } from './navigation/action-creators'
import siteSocket from './network/site-socket'
import styles from './main-layout.css'

import AvatarButton from './avatars/avatar-button.jsx'
import Divider from './material/left-nav/divider.jsx'
import IconButton from './material/icon-button.jsx'
import LeftNav from './material/left-nav/left-nav.jsx'
import RaisedButton from './material/raised-button.jsx'
import Section from './material/left-nav/section.jsx'
import Subheader from './material/left-nav/subheader.jsx'
import ConnectedDialog from './dialogs/connected-dialog.jsx'
import ActiveUserCount from './serverstatus/active-users.jsx'

import ChatNavEntry from './chat/nav-entry.jsx'
import LobbyNavEntry from './lobbies/nav-entry.jsx'
import WhisperNavEntry from './whispers/nav-entry.jsx'

import auther from './auth/auther'
import { openDialog } from './dialogs/dialog-action-creator'
import { createLobby, joinLobby } from './lobbies/action-creators'

function stateToProps(state) {
  return {
    auth: state.auth,
    lobby: state.lobby.name ? state.lobby : undefined,
    chatChannels: state.chatChannels,
    whispers: state.whispers,
  }
}

@connect(stateToProps)
class MainLayout extends React.Component {
  componentWillMount() {
    if (!this.props.children) {
      this.props.dispatch(goToIndex(replacePath))
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.children) {
      nextProps.dispatch(goToIndex(replacePath))
    }
  }

  componentDidMount() {
    siteSocket.connect()
  }

  componentWillUnmount() {
    siteSocket.disconnect()
  }

  render() {
    let lobbyElems
    if (this.props.lobby) {
      const lobby = this.props.lobby
      lobbyElems = [
        <Subheader key='lobby-header'>Lobby</Subheader>,
        <Section key='lobby-section'>
          <LobbyNavEntry key='lobby' lobby={lobby.name} />
        </Section>,
        <Divider key='lobby-divider'/>
      ]
    }

    const channels = this.props.chatChannels.map(
        channel => <ChatNavEntry key={channel.name} channel={channel.name} />)
    const whispers = this.props.whispers.map(
        whisper => <WhisperNavEntry key={whisper.from} user={whisper.from} />)

    return (<div className={styles.layout}>
      <LeftNav footer={<ActiveUserCount className={styles.userCount}/>}>
        {lobbyElems}
        <Subheader>Chat channels</Subheader>
        <Section>
          {channels}
        </Section>
        <Divider/>
        <Subheader>Whispers</Subheader>
        <Section>
          {whispers}
        </Section>
      </LeftNav>
      { this.props.children }
      <div className={styles.activities}>
        <div className={styles.activitiesAppBar}>
          <IconButton icon='settings' title='Settings' onClick={::this.onSettingsClicked} />
          <AvatarButton user={this.props.auth.name} title='Log out'
              onClick={::this.onLogOutClicked} />
        </div>
        <div className={styles.activitiesContent}>
          <RaisedButton color='primary' label='Create lobby' onClick={::this.onCreateLobbyClick} />
          <RaisedButton color='primary' label='Join lobby' onClick={::this.onJoinLobbyClick} />
        </div>
      </div>
      <ConnectedDialog />
    </div>)
  }

  onSettingsClicked() {
    this.props.dispatch(openDialog('settings'))
  }

  onLogOutClicked() {
    this.props.dispatch(auther.logOut().action)
  }

  onCreateLobbyClick() {
    this.props.dispatch(createLobby('baby\'s first lobby', 'c:\\lt.scm', 4))
  }

  onJoinLobbyClick() {
    this.props.dispatch(joinLobby('baby\'s first lobby'))
  }
}

export default MainLayout
