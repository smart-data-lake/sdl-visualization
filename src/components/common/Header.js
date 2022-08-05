import React from 'react';
import Navbar from './Navbar';
import './Header.css';

function Header () {

  return (
    <section className="header">
      <section className="header-top">
        <section className="header-top__logo">
        <h1 className="header-logo">
          <img src="sdl_logo.png" alt="logo" className="logo" />
        </h1>
        </section>
        <section className="header-top__navbar">
          <section className="header-top__navigation">
            <Navbar />
          </section>
          <hr className="header-top__seperator" />
        </section>
      </section>
      <section className="header-bottom">
        <section className="header-bottom__phone">
          +41-000-000000
        </section>
        <section className="header-bottom__email">
          example.mail@elca.ch
        </section>
      </section>
    </section>
  )
}

export default Header;