const Eth = require('./ethjs');


const jQuery = $ = require('jquery');

$(function(){
  var hash = window.location.hash;
  hash && $('ul.nav a[href="' + hash + '"]').tab('show');

  $('.nav-tabs a').click(function (e) {
    $(this).tab('show');
    var scrollmem = $('body').scrollTop();
    window.location.hash = this.hash;
    $('html,body').scrollTop(scrollmem);
  });
});

$(function ($) {
    "use strict";
    var $window = $(window);

    /* Offset start */
    var html_body = $('html, body'),
        nav = $('nav'),
        navOffset = nav.offset().top,
        $window = $(window);


    /*======== Sticky header ===========*/
    $('.navbar-collapse a').on('click', function () {
        $(".navbar-collapse").collapse('hide');
    });



    // If a link has a dropdown, add sub menu toggle.
    $('nav ul li a:not(:only-child)').click(function(e) {
      $(this).siblings('.nav-dropdown').toggle();
      // Close one dropdown when selecting another
      $('.nav-dropdown').not($(this).siblings()).hide();
      e.stopPropagation();
    });
    // Clicking away from dropdown will remove the dropdown class
    $('html').click(function() {
      $('.nav-dropdown').hide();
    });
    // Toggle open and close nav styles on click
    $('#nav-toggle').click(function() {
      $('nav ul').slideToggle();
    });
    // Hamburger to X toggle
    $('#nav-toggle').on('click', function() {
      this.classList.toggle('active');
    });


    //scrollspy menu
    $('body').scrollspy({
        target: '#navbarSupportedContent',
        offset: 80
    });

    /* offset ends */

    $('#mainHeader  a').on('click', function () {
        if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
            var target = $(this.hash);
            target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
            if (target.length) {
                html_body.animate({
                    scrollTop: target.offset().top - 30
                }, 1500);
                return false;
            }
        }
    });


    //for scroll bottom to top js here
    if ($('.totop').length) {
        var scrollTrigger = 100, // px
            backToTop = function () {
                var scrollTop = $(window).scrollTop();
                if (scrollTop > scrollTrigger) {
                    $('.totop').addClass('show');
                } else {
                    $('.totop').removeClass('show');
                }
            };
        backToTop();
        $(window).on('scroll', function () {
            backToTop();
        });
        $('.totop').on('click', function (e) {
            e.preventDefault();
            $('html,body').animate({
                scrollTop: 0
            }, 700);
        });
    }
    $window.on('scroll', function () {
        if ($window.scrollTop()) {
            $("#mainHeader").addClass('stiky');
        } else {
            $("#mainHeader").removeClass('stiky');
        }
    });



    ''
    jQuery(window).on('load', function () {

        /*---------------------------------------------------
            Site Preloader
        ----------------------------------------------------*/
        var $sitePreloaderSelector = $('.site-preloader');
        $sitePreloaderSelector.fadeOut(500);


    });




}(jQuery));
